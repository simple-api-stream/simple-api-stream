import type { SimpleApiParser } from "@simple-api-stream/core";
import {
  AliasEvent,
  CommentEvent,
  EndDocumentEvent,
  EndMappingEvent,
  EndSequenceEvent,
  KeyEvent,
  ScalarEvent,
  StartDocumentEvent,
  StartMappingEvent,
  StartSequenceEvent,
} from "./event/index.js";
import type { SAYEventInterface, ScalarStyle } from "./event-interface/index.js";
import type { SAYHandler } from "./interface/index.js";
import { toErrorMessage } from "./utils/index.js";
import {
  computeFlowDepthDelta,
  extractNodeProperties,
  parseDoubleQuoted,
  parseFlowNode,
  parseSingleQuoted,
  resolvePlainScalar,
  stripTrailingComment,
} from "./utils/yamlScalars.js";

/**
 * Configuration options for `YAMLTextToSAYParser`.
 */
export type YAMLTextToSAYParserOptions = {
  /** Do not emit `startDocument` / `endDocument` events (default: `false`). */
  skipDocument?: boolean
  /** Emit `comment` events for `# ...` comments (default: `false`). */
  comments?: boolean
  /** Allow multiple YAML documents separated by `---` (default: `true`). */
  multiple?: boolean
  /** Strip a leading UTF-8 BOM (`\uFEFF`) if present (default: `true`). */
  stripBom?: boolean
};

/**
 * Optional debug lifecycle hooks for `YAMLTextToSAYParser`.
 */
export type YAMLTextToSAYParserAdditionalHandler = {
  onParseBefore: (status: Status) => void
  onParseAfter: (status: Status) => void
  onParseLoopBefore: (status: Status) => void
  onParseLoopAfter: (status: Status) => void
};

type BlockFrame = {
  type: "mapping" | "sequence"
  indent: number
  expectingValue: boolean
  pendingMeta?: { anchor?: string, tag?: string }
};

type BlockScalarState = {
  style: "literal" | "folded"
  chomp: "clip" | "strip" | "keep"
  parentIndent: number
  contentIndent: number | null
  lines: string[]
  meta?: { anchor?: string, tag?: string }
};

type FlowBufferState = {
  text: string
  depth: number
  meta?: { anchor?: string, tag?: string }
};

type Status = {
  get options(): YAMLTextToSAYParserOptions
  get buffer(): string
  get line(): number
  get eof(): boolean
};

/**
 * Error thrown by `YAMLTextToSAYParser` when malformed YAML syntax is encountered.
 */
export class YAMLTextToSAYParserError extends Error implements Status {
  options: YAMLTextToSAYParserOptions;
  buffer: string;
  line: number;
  eof: boolean;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "YAMLTextToSAYParserError";
    ({
      options: this.options,
      buffer: this.buffer,
      line: this.line,
      eof: this.eof,
    } = status);
  }
}

function findMappingColon(text: string): number {
  let quote: "\"" | "'" | null = null;
  let flowDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote === "\"") {
      if (ch === "\\") i++;
      else if (ch === "\"") quote = null;
      continue;
    }
    if (quote === "'") {
      if (ch === "'") {
        if (text[i + 1] === "'") i++;
        else quote = null;
      }
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
    }
    else if (ch === "[" || ch === "{") {
      flowDepth++;
    }
    else if (ch === "]" || ch === "}") {
      flowDepth--;
    }
    else if (ch === ":" && flowDepth === 0) {
      const next = text[i + 1];
      if (next === undefined || next === " " || next === "\t") {
        return i;
      }
    }
  }
  return -1;
}

function parseMappingKeyText(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.startsWith("\"")) {
    const parsed = parseDoubleQuoted(trimmed, 0);
    if (parsed.endIndex !== trimmed.length) {
      throw new Error(`Unexpected trailing characters in quoted key: ${trimmed}`);
    }
    return parsed.value;
  }
  if (trimmed.startsWith("'")) {
    const parsed = parseSingleQuoted(trimmed, 0);
    if (parsed.endIndex !== trimmed.length) {
      throw new Error(`Unexpected trailing characters in quoted key: ${trimmed}`);
    }
    return parsed.value;
  }
  return trimmed;
}

function parseBlockScalarHeader(text: string): {
  style: "literal" | "folded"
  chomp: "clip" | "strip" | "keep"
  explicitIndent?: number
} | null {
  const m = /^([|>])([+-]?[1-9]?|[1-9]?[+-]?)$/.exec(text);
  if (!m) return null;
  const style = m[1] === "|" ? "literal" : "folded";
  const mod = m[2];
  let chomp: "clip" | "strip" | "keep" = "clip";
  let explicitIndent: number | undefined;
  for (const ch of mod) {
    if (ch === "-") chomp = "strip";
    else if (ch === "+") chomp = "keep";
    else explicitIndent = Number(ch);
  }
  return {
    style,
    chomp,
    ...(explicitIndent !== undefined ? { explicitIndent } : {}),
  };
}

function finalizeBlockScalar(state: BlockScalarState): string {
  const indent = state.contentIndent ?? 0;
  const stripped = state.lines.map(line => (line.length <= indent ? "" : line.slice(indent)));

  let trailingEmpty = 0;
  while (trailingEmpty < stripped.length && stripped[stripped.length - 1 - trailingEmpty] === "") {
    trailingEmpty++;
  }

  const bodyLines = stripped.slice(0, stripped.length - trailingEmpty);
  let body: string;

  if (bodyLines.length === 0) {
    body = "";
  }
  else if (state.style === "literal") {
    body = bodyLines.join("\n");
  }
  else {
    // Folded scalar (`>`): single newlines between regular lines become spaces; blank lines & indented lines keep newlines
    let out = "";
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];
      if (i === 0) {
        out += line;
        continue;
      }
      const prev = bodyLines[i - 1];
      const prevMoreIndented = prev.startsWith(" ") || prev.startsWith("\t");
      const currMoreIndented = line.startsWith(" ") || line.startsWith("\t");
      if (line === "") {
        out += "\n";
      }
      else if (prev === "") {
        // Blank line(s) already emitted one \n per blank line; add one more if previous non-blank was more-indented
        out += line;
      }
      else if (prevMoreIndented || currMoreIndented) {
        out += `\n${line}`;
      }
      else {
        out += ` ${line}`;
      }
    }
    body = out;
  }

  if (state.chomp === "strip") {
    return body;
  }
  if (state.chomp === "keep") {
    const suffix = bodyLines.length === 0 ? "\n".repeat(trailingEmpty) : `\n${"\n".repeat(trailingEmpty)}`;
    return `${body}${suffix}`;
  }
  // clip
  return bodyLines.length === 0 ? "" : `${body}\n`;
}

/**
 * Incremental streaming YAML 1.2 (Core Schema subset) parser that emits SAY (Simple API for YAML) events.
 */
export class YAMLTextToSAYParser implements SimpleApiParser<string> {
  #handler: Partial<SAYHandler & YAMLTextToSAYParserAdditionalHandler>;
  #options: YAMLTextToSAYParserOptions;
  #skipDocument: boolean;
  #comments: boolean;
  #multiple: boolean;
  #stripBom: boolean;

  #buffer = "";
  #line = 0;
  #eof = false;
  #bomChecked = false;
  #errored = false;

  #inDocument = false;
  #documentCount = 0;
  #hasRootValue = false;
  #stack: BlockFrame[] = [];
  #blockScalar: BlockScalarState | null = null;
  #flowBuffer: FlowBufferState | null = null;

  constructor(
    options: YAMLTextToSAYParserOptions & {
      handler?: Partial<SAYHandler & YAMLTextToSAYParserAdditionalHandler>
    } = {},
  ) {
    const { handler, ...parserOptions } = options;
    this.#handler = handler ?? {};
    this.#options = parserOptions;
    this.#skipDocument = parserOptions.skipDocument ?? false;
    this.#comments = parserOptions.comments ?? false;
    this.#multiple = parserOptions.multiple ?? true;
    this.#stripBom = parserOptions.stripBom ?? true;
  }

  #status(): Status {
    return {
      options: this.#options,
      buffer: this.#buffer,
      line: this.#line,
      eof: this.#eof,
    };
  }

  /**
   * Returns the current parser status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): YAMLTextToSAYParserError {
    ({ message, options } = toErrorMessage(message, options));
    return new YAMLTextToSAYParserError(message as string, this.#status(), options);
  }

  #emitEvent(event: SAYEventInterface): void {
    switch (event.name) {
      case "startDocument":
        this.#handler.onStartDocument?.(event);
        break;
      case "endDocument":
        this.#handler.onEndDocument?.(event);
        break;
      case "comment":
        this.#handler.onComment?.(event);
        break;
      case "startMapping":
        this.#handler.onStartMapping?.(event);
        break;
      case "endMapping":
        this.#handler.onEndMapping?.(event);
        break;
      case "startSequence":
        this.#handler.onStartSequence?.(event);
        break;
      case "endSequence":
        this.#handler.onEndSequence?.(event);
        break;
      case "key":
        this.#handler.onKey?.(event);
        break;
      case "scalar":
        this.#handler.onScalar?.(event);
        break;
      case "alias":
        this.#handler.onAlias?.(event);
        break;
    }
  }

  #startDocument(): void {
    if (this.#inDocument) return;
    if (!this.#multiple && this.#documentCount >= 1) {
      throw this.#makeError(`Multiple YAML documents are not allowed at line ${this.#line}`);
    }
    this.#inDocument = true;
    this.#hasRootValue = false;
    this.#documentCount++;
    if (!this.#skipDocument) {
      this.#emitEvent(new StartDocumentEvent());
    }
  }

  #closeFramesAbove(targetIndent: number, closeEqualSequence = false): void {
    while (this.#stack.length > 0) {
      const top = this.#stack[this.#stack.length - 1];
      const shouldClose
        = top.indent > targetIndent
          || (closeEqualSequence && top.indent === targetIndent && top.type === "sequence");
      if (!shouldClose) break;
      this.#popFrame();
    }
  }

  #popFrame(): void {
    const frame = this.#stack.pop()!;
    if (frame.expectingValue) {
      this.#emitEvent(new ScalarEvent("null", null, { style: "plain", ...frame.pendingMeta }).toInterface());
    }
    if (frame.type === "mapping") {
      this.#emitEvent(new EndMappingEvent());
    }
    else {
      this.#emitEvent(new EndSequenceEvent());
    }
  }

  #endDocument(): void {
    if (!this.#inDocument) return;
    this.#flushBlockScalar();
    if (this.#flowBuffer !== null) {
      throw this.#makeError(`Unterminated flow collection before end of document at line ${this.#line}`);
    }
    while (this.#stack.length > 0) {
      this.#popFrame();
    }
    this.#inDocument = false;
    this.#hasRootValue = false;
    if (!this.#skipDocument) {
      this.#emitEvent(new EndDocumentEvent());
    }
  }

  #flushBlockScalar(): void {
    if (this.#blockScalar === null) return;
    const state = this.#blockScalar;
    this.#blockScalar = null;
    const value = finalizeBlockScalar(state);
    this.#consumeValueSlot();
    this.#emitEvent(new ScalarEvent("string", value, { style: state.style, ...state.meta }).toInterface());
  }

  #consumeValueSlot(): void {
    this.#hasRootValue = true;
    const top = this.#stack[this.#stack.length - 1];
    if (top?.expectingValue) {
      top.expectingValue = false;
      top.pendingMeta = undefined;
    }
  }

  #reportError(err: unknown): void {
    this.#errored = true;
    if (this.#handler.onError) {
      this.#handler.onError(err);
    }
    else {
      throw err;
    }
  }

  /**
   * Feeds a chunk of YAML text into the parser.
   */
  enqueue(chunk: string): void {
    if (this.#errored) return;
    if (this.#eof) {
      this.#reportError(this.#makeError("Cannot enqueue after flush"));
      return;
    }
    this.#buffer += chunk;
    this.#parse();
  }

  /**
   * Signals the end of the YAML input stream and flushes remaining buffered content.
   */
  flush(): void {
    if (this.#errored || this.#eof) return;
    this.#eof = true;
    this.#parse();
    if (!this.#errored) {
      try {
        this.#flushBlockScalar();
        if (this.#flowBuffer !== null) {
          throw this.#makeError(`Unterminated flow collection at end of stream`);
        }
        if (this.#inDocument) {
          this.#endDocument();
        }
      }
      catch (err: unknown) {
        this.#reportError(err instanceof YAMLTextToSAYParserError ? err : this.#makeError(err));
      }
    }
  }

  #parse(): void {
    this.#handler.onParseBefore?.(this.#status());
    try {
      if (!this.#bomChecked && this.#buffer.length > 0) {
        this.#bomChecked = true;
        if (this.#stripBom && this.#buffer.startsWith("\uFEFF")) {
          this.#buffer = this.#buffer.slice(1);
        }
      }

      while (this.#buffer.length > 0) {
        this.#handler.onParseLoopBefore?.(this.#status());

        let lineEnd = -1;
        let nextStart = -1;

        for (let i = 0; i < this.#buffer.length; i++) {
          const ch = this.#buffer[i];
          if (ch === "\n") {
            lineEnd = i;
            nextStart = i + 1;
            break;
          }
          if (ch === "\r") {
            if (i + 1 < this.#buffer.length) {
              lineEnd = i;
              nextStart = this.#buffer[i + 1] === "\n" ? i + 2 : i + 1;
              break;
            }
            if (this.#eof) {
              lineEnd = i;
              nextStart = i + 1;
              break;
            }
            this.#handler.onParseLoopAfter?.(this.#status());
            return;
          }
        }

        if (lineEnd === -1) {
          if (!this.#eof) {
            this.#handler.onParseLoopAfter?.(this.#status());
            return;
          }
          lineEnd = this.#buffer.length;
          nextStart = this.#buffer.length;
        }

        const rawLine = this.#buffer.slice(0, lineEnd);
        this.#buffer = this.#buffer.slice(nextStart);
        this.#line++;

        this.#parseLine(rawLine);
        this.#handler.onParseLoopAfter?.(this.#status());
      }
    }
    catch (err: unknown) {
      this.#reportError(err instanceof YAMLTextToSAYParserError ? err : this.#makeError(err));
    }
    finally {
      this.#handler.onParseAfter?.(this.#status());
    }
  }

  #parseLine(rawLine: string): void {
    // 1. Inside a block scalar (`|` or `>`)
    if (this.#blockScalar !== null) {
      const state = this.#blockScalar;
      const trimmed = rawLine.trim();
      if (trimmed.length === 0) {
        state.lines.push(rawLine);
        return;
      }
      const lineIndent = this.#countLeadingSpaces(rawLine);
      if (state.contentIndent === null) {
        if (lineIndent > state.parentIndent) {
          state.contentIndent = lineIndent;
          state.lines.push(rawLine);
          return;
        }
        // Empty block scalar, line belongs to outer scope
        this.#flushBlockScalar();
      }
      else if (lineIndent >= state.contentIndent) {
        state.lines.push(rawLine);
        return;
      }
      else {
        this.#flushBlockScalar();
      }
    }

    // 2. Inside a multi-line flow collection
    if (this.#flowBuffer !== null) {
      const { content, comment } = stripTrailingComment(rawLine);
      this.#flowBuffer.text += `\n${content}`;
      this.#flowBuffer.depth += computeFlowDepthDelta(content);
      if (comment !== undefined && this.#comments) {
        this.#emitEvent(new CommentEvent(comment));
      }
      if (this.#flowBuffer.depth <= 0) {
        const fb = this.#flowBuffer;
        this.#flowBuffer = null;
        this.#consumeValueSlot();
        for (const ev of parseFlowNode(fb.text, fb.meta)) {
          this.#emitEvent(ev);
        }
      }
      return;
    }

    // 3. Measure leading indentation (YAML forbids leading tabs for block indentation)
    const indent = this.#countLeadingSpaces(rawLine);
    const restOfLine = rawLine.slice(indent);
    if (restOfLine.length === 0) return;

    // Comment-only line
    if (restOfLine.startsWith("#")) {
      if (this.#comments) {
        this.#emitEvent(new CommentEvent(restOfLine.slice(1)));
      }
      return;
    }

    // Document start (`---`) and end (`...`) markers at column 0
    if (indent === 0) {
      if (restOfLine === "---" || restOfLine.startsWith("--- ") || restOfLine.startsWith("---\t")) {
        if (this.#inDocument) {
          this.#endDocument();
        }
        this.#startDocument();
        const afterMarker = restOfLine.slice(3).trimStart();
        if (afterMarker.length > 0) {
          const { content, comment } = stripTrailingComment(afterMarker);
          if (content.length > 0) {
            this.#parseInlineValue(content, -1);
          }
          if (comment !== undefined && this.#comments) {
            this.#emitEvent(new CommentEvent(comment));
          }
        }
        return;
      }
      if (restOfLine === "..." || restOfLine.startsWith("... ") || restOfLine.startsWith("...\t")) {
        const { content, comment } = stripTrailingComment(restOfLine.slice(3).trimStart());
        if (content.length > 0) {
          throw this.#makeError(`Unexpected content after '...' document end marker at line ${this.#line}`);
        }
        this.#endDocument();
        if (comment !== undefined && this.#comments) {
          this.#emitEvent(new CommentEvent(comment));
        }
        return;
      }
    }

    this.#startDocument();

    const { content, comment } = stripTrailingComment(restOfLine);
    this.#parseContent(content, indent);
    if (comment !== undefined && this.#comments) {
      this.#emitEvent(new CommentEvent(comment));
    }
  }

  #countLeadingSpaces(rawLine: string): number {
    let i = 0;
    while (i < rawLine.length) {
      if (rawLine[i] === " ") {
        i++;
      }
      else if (rawLine[i] === "\t") {
        throw this.#makeError(`Tab character is not allowed for block indentation at line ${this.#line}`);
      }
      else {
        break;
      }
    }
    return i;
  }

  #parseContent(content: string, indent: number): void {
    // Sequence item (`-` or `- ...`)
    if (content === "-" || content.startsWith("- ") || content.startsWith("-\t")) {
      this.#closeFramesAbove(indent, false);
      const top = this.#stack[this.#stack.length - 1];

      if (!top || top.type !== "sequence" || top.indent < indent) {
        const meta = top?.expectingValue ? top.pendingMeta : undefined;
        this.#consumeValueSlot();
        this.#emitEvent(new StartSequenceEvent(meta));
        this.#stack.push({ type: "sequence", indent, expectingValue: false });
      }
      else if (top.expectingValue) {
        // Previous sequence item had no value -> emit null
        this.#emitEvent(new ScalarEvent("null", null, { style: "plain", ...top.pendingMeta }).toInterface());
        top.expectingValue = false;
        top.pendingMeta = undefined;
      }

      const seqFrame = this.#stack[this.#stack.length - 1];
      const afterDash = content.slice(1);
      const trimmedAfter = afterDash.trimStart();
      if (trimmedAfter.length === 0) {
        seqFrame.expectingValue = true;
        return;
      }
      const itemIndent = indent + 1 + (afterDash.length - trimmedAfter.length);
      seqFrame.expectingValue = true;
      this.#parseContent(trimmedAfter, itemIndent);
      return;
    }

    // Check if this is a mapping entry (`key: value`)
    const colonIdx = findMappingColon(content);
    if (colonIdx !== -1 && !content.startsWith("{") && !content.startsWith("[")) {
      this.#closeFramesAbove(indent, true);
      let top = this.#stack[this.#stack.length - 1];

      if (!top || top.type !== "mapping" || top.indent < indent) {
        const meta = top?.expectingValue ? top.pendingMeta : undefined;
        this.#consumeValueSlot();
        this.#emitEvent(new StartMappingEvent(meta));
        top = { type: "mapping", indent, expectingValue: false };
        this.#stack.push(top);
      }
      else if (top.expectingValue) {
        this.#emitEvent(new ScalarEvent("null", null, { style: "plain", ...top.pendingMeta }).toInterface());
        top.expectingValue = false;
        top.pendingMeta = undefined;
      }

      const key = parseMappingKeyText(content.slice(0, colonIdx));
      this.#emitEvent(new KeyEvent(key));
      top.expectingValue = true;

      const afterColon = content.slice(colonIdx + 1).trimStart();
      if (afterColon.length === 0) {
        return;
      }
      this.#parseInlineValue(afterColon, indent);
      return;
    }

    // Standalone scalar / flow value (either root or indented value of a pending mapping/sequence slot)
    this.#closeFramesAbove(indent, false);
    this.#parseInlineValue(content, indent);
  }

  #parseInlineValue(rawValue: string, parentIndent: number): void {
    const { rest, anchor, tag } = extractNodeProperties(rawValue);
    const meta = anchor !== undefined || tag !== undefined
      ? { ...(anchor !== undefined ? { anchor } : {}), ...(tag !== undefined ? { tag } : {}) }
      : undefined;

    // Only properties on this line (e.g. `key: &a` followed by nested mapping/sequence on next line)
    if (rest.length === 0) {
      const top = this.#stack[this.#stack.length - 1];
      if (top?.expectingValue) {
        top.pendingMeta = meta;
        return;
      }
      this.#consumeValueSlot();
      this.#emitEvent(new ScalarEvent("null", null, { style: "plain", ...meta }).toInterface());
      return;
    }

    // Block scalar header (`|`, `|-`, `|+`, `>`, `>-`, `>+`, `|2`, ...)
    const blockHeader = parseBlockScalarHeader(rest);
    if (blockHeader !== null) {
      this.#blockScalar = {
        style: blockHeader.style,
        chomp: blockHeader.chomp,
        parentIndent,
        contentIndent: blockHeader.explicitIndent !== undefined ? parentIndent + blockHeader.explicitIndent : null,
        lines: [],
        meta,
      };
      return;
    }

    // Flow collection (`[...]` or `{...}`), possibly multi-line
    if (rest.startsWith("[") || rest.startsWith("{")) {
      const delta = computeFlowDepthDelta(rest);
      if (delta > 0) {
        this.#flowBuffer = { text: rest, depth: delta, meta };
        return;
      }
      this.#consumeValueSlot();
      for (const ev of parseFlowNode(rest, meta)) {
        this.#emitEvent(ev);
      }
      return;
    }

    // Alias (`*name`)
    if (rest.startsWith("*")) {
      const m = /^\*([^\s,[\]{}]+)$/.exec(rest);
      if (!m) throw this.#makeError(`Invalid alias syntax at line ${this.#line}: ${rest}`);
      this.#consumeValueSlot();
      this.#emitEvent(new AliasEvent(m[1]));
      return;
    }

    // Double-quoted scalar
    if (rest.startsWith("\"")) {
      const parsed = parseDoubleQuoted(rest, 0);
      if (parsed.endIndex !== rest.length) {
        throw this.#makeError(`Unexpected trailing characters after double-quoted scalar at line ${this.#line}`);
      }
      this.#consumeValueSlot();
      this.#emitEvent(new ScalarEvent("string", parsed.value, { style: "double" satisfies ScalarStyle, ...meta }).toInterface());
      return;
    }

    // Single-quoted scalar
    if (rest.startsWith("'")) {
      const parsed = parseSingleQuoted(rest, 0);
      if (parsed.endIndex !== rest.length) {
        throw this.#makeError(`Unexpected trailing characters after single-quoted scalar at line ${this.#line}`);
      }
      this.#consumeValueSlot();
      this.#emitEvent(new ScalarEvent("string", parsed.value, { style: "single" satisfies ScalarStyle, ...meta }).toInterface());
      return;
    }

    // Plain scalar
    if (this.#stack.length === 0 && this.#hasRootValue) {
      throw this.#makeError(`Unexpected trailing scalar at root level at line ${this.#line}`);
    }
    this.#consumeValueSlot();
    this.#emitEvent(resolvePlainScalar(rest, meta));
  }
}
