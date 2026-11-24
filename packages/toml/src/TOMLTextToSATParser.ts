import type { SimpleApiParser } from "@simple-api-stream/core";
import {
  ArrayTableEvent,
  CommentEvent,
  EndArrayEvent,
  EndDocumentEvent,
  EndInlineTableEvent,
  KeyEvent,
  StartArrayEvent,
  StartDocumentEvent,
  StartInlineTableEvent,
  TableEvent,
  ValueEvent,
} from "./event/index.js";
import type { ValueDictionary, ValueType } from "./event-interface/index.js";
import type { SATHandler } from "./interface/index.js";
import { toErrorMessage } from "./utils/index.js";

const NEED_MORE = Symbol.for("TOMLTextToSATParser.NEED_MORE");

type ContainerFrame
  = { type: "array", expect: "valueOrEnd" | "commaOrEnd" }
    | { type: "inlineTable", expect: "keyOrValue" | "value" | "commaOrEnd" };

type TopState = "lineStart" | "expectValue" | "afterValue";

type Status = {
  get buffer(): string
  get pos(): number
  get state(): string
  get containerStack(): ContainerFrame[]
};

/**
 * Error thrown by `TOMLTextToSATParser` when invalid TOML syntax or an invalid state transition is encountered.
 */
export class TOMLTextToSATParserError extends Error implements Status {
  buffer: string;
  pos: number;
  state: string;
  containerStack: ContainerFrame[];

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "TOMLTextToSATParserError";
    ({
      buffer: this.buffer,
      pos: this.pos,
      state: this.state,
      containerStack: this.containerStack,
    } = status);
  }
}

/**
 * Optional lifecycle hook callbacks invoked during `TOMLTextToSATParser` parsing.
 */
export type TOMLTextToSATParserAdditionalHandler = {
  onParseBefore(arg: Status): void
  onParseLoopBefore(arg: Status): void
  onParseLoopAfter(arg: Status): void
  onParseAfter(arg: Status): void
};

/**
 * Configuration options for `TOMLTextToSATParser`.
 */
export type TOMLTextToSATParserOptions = {
  skipDocument?: boolean
  comments?: boolean
};

const BARE_KEY_CHAR = /^[A-Za-z0-9_-]$/;
const DEC_INT_REGEX = /^[+-]?(?:0|[1-9](?:_?[0-9])*)$/;
const HEX_INT_REGEX = /^0x[0-9A-Fa-f](?:_?[0-9A-Fa-f])*$/;
const OCT_INT_REGEX = /^0o[0-7](?:_?[0-7])*$/;
const BIN_INT_REGEX = /^0b[01](?:_?[01])*$/;
const FLOAT_REGEX = /^[+-]?(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?$/;
const OFFSET_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;
const LOCAL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const LOCAL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_REGEX = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

/**
 * Streaming TOML parser that emits SAT events to a handler as text chunks are enqueued.
 */
export class TOMLTextToSATParser implements SimpleApiParser<string> {
  #buffer = "";
  #pos = 0;
  #topState: TopState = "lineStart";
  #stack: ContainerFrame[] = [];
  #handler: Partial<SATHandler & TOMLTextToSATParserAdditionalHandler>;
  #skipDocument: boolean;
  #comments: boolean;
  #documentStarted = false;
  #flushed = false;

  constructor(
    { handler, skipDocument, comments }: { handler: Partial<SATHandler & TOMLTextToSATParserAdditionalHandler> } & TOMLTextToSATParserOptions,
  ) {
    this.#handler = handler;
    this.#skipDocument = skipDocument ?? false;
    this.#comments = comments ?? false;
  }

  #status(): Status {
    return {
      buffer: this.#buffer,
      pos: this.#pos,
      state: this.#stack.length > 0 ? this.#stack[this.#stack.length - 1].type : this.#topState,
      containerStack: structuredClone(this.#stack),
    };
  }

  /**
   * Returns the current parser status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: string | Error, options?: ErrorOptions): TOMLTextToSATParserError {
    ({ message, options } = toErrorMessage(message, options));
    return new TOMLTextToSATParserError(message, this.#status(), options);
  }

  #reportError(err: unknown): never {
    const error = err instanceof TOMLTextToSATParserError ? err : this.#makeError(err as Error);
    this.#handler.onError?.(error);
    throw error;
  }

  #ensureDocumentStarted(): void {
    if (!this.#documentStarted) {
      this.#documentStarted = true;
      if (!this.#skipDocument) {
        this.#handler.onStartDocument?.(new StartDocumentEvent());
      }
    }
  }

  /**
   * Appends a TOML text chunk and parses available tokens, emitting SAT events.
   */
  enqueue(chunk: string): void {
    if (this.#flushed) {
      this.#reportError(this.#makeError("Cannot enqueue after flush()"));
    }
    if (chunk.length === 0) return;
    this.#buffer += chunk;
    this.#ensureDocumentStarted();
    this.#parse(false);
  }

  /**
   * Finalizes parsing of any remaining buffered characters and emits closing events.
   */
  flush(): void {
    if (this.#flushed) return;
    this.#flushed = true;
    this.#ensureDocumentStarted();
    this.#parse(true);
    if (!this.#skipDocument) {
      this.#handler.onEndDocument?.(new EndDocumentEvent());
    }
  }

  #parse(isFlush: boolean): void {
    this.#handler.onParseBefore?.(this.#status());
    try {
      while (true) {
        this.#handler.onParseLoopBefore?.(this.#status());
        const progressed = this.#step(isFlush);
        this.#handler.onParseLoopAfter?.(this.#status());
        if (!progressed) break;
      }
    }
    catch (err) {
      this.#reportError(err);
    }
    this.#handler.onParseAfter?.(this.#status());

    if (this.#pos > 0) {
      this.#buffer = this.#buffer.slice(this.#pos);
      this.#pos = 0;
    }
  }

  #step(isFlush: boolean): boolean {
    if (this.#stack.length > 0) {
      const top = this.#stack[this.#stack.length - 1];
      if (top.type === "array") {
        return this.#stepArray(top, isFlush);
      }
      return this.#stepInlineTable(top, isFlush);
    }

    if (this.#topState === "lineStart") {
      return this.#stepLineStart(isFlush);
    }
    if (this.#topState === "expectValue") {
      return this.#stepExpectValue(isFlush);
    }
    return this.#stepAfterValue(isFlush);
  }

  #skipHorizontalWhitespace(): void {
    while (this.#pos < this.#buffer.length) {
      const ch = this.#buffer[this.#pos];
      if (ch === " " || ch === "\t") {
        this.#pos++;
      }
      else {
        break;
      }
    }
  }

  #tryConsumeNewline(isFlush: boolean): boolean | typeof NEED_MORE {
    const ch = this.#buffer[this.#pos];
    if (ch === "\n") {
      this.#pos++;
      return true;
    }
    if (ch === "\r") {
      if (this.#pos + 1 >= this.#buffer.length) {
        if (!isFlush) return NEED_MORE;
        throw this.#makeError("Bare CR is not allowed in TOML");
      }
      if (this.#buffer[this.#pos + 1] === "\n") {
        this.#pos += 2;
        return true;
      }
      throw this.#makeError("Bare CR is not allowed in TOML");
    }
    return false;
  }

  #readComment(isFlush: boolean): string | typeof NEED_MORE {
    const start = this.#pos;
    // skip '#'
    this.#pos++;
    while (this.#pos < this.#buffer.length) {
      const ch = this.#buffer[this.#pos];
      if (ch === "\n" || ch === "\r") {
        return this.#buffer.slice(start + 1, this.#pos);
      }
      this.#pos++;
    }
    if (!isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }
    return this.#buffer.slice(start + 1, this.#pos);
  }

  #skipArrayWhitespaceAndComments(isFlush: boolean): boolean {
    while (this.#pos < this.#buffer.length) {
      const ch = this.#buffer[this.#pos];
      if (ch === " " || ch === "\t") {
        this.#pos++;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        const nl = this.#tryConsumeNewline(isFlush);
        if (nl === NEED_MORE) return false;
        continue;
      }
      if (ch === "#") {
        const comment = this.#readComment(isFlush);
        if (comment === NEED_MORE) return false;
        if (this.#comments) {
          this.#handler.onComment?.(new CommentEvent(comment));
        }
        continue;
      }
      break;
    }
    return true;
  }

  #stepLineStart(isFlush: boolean): boolean {
    const checkpoint = this.#pos;
    this.#skipHorizontalWhitespace();
    if (this.#pos >= this.#buffer.length) {
      if (!isFlush) {
        this.#pos = checkpoint;
        return false;
      }
      return false;
    }

    const nl = this.#tryConsumeNewline(isFlush);
    if (nl === NEED_MORE) {
      this.#pos = checkpoint;
      return false;
    }
    if (nl) return true;

    const ch = this.#buffer[this.#pos];
    if (ch === "#") {
      const comment = this.#readComment(isFlush);
      if (comment === NEED_MORE) {
        this.#pos = checkpoint;
        return false;
      }
      if (this.#comments) {
        this.#handler.onComment?.(new CommentEvent(comment));
      }
      return true;
    }

    if (ch === "[") {
      if (this.#pos + 1 >= this.#buffer.length) {
        if (!isFlush) {
          this.#pos = checkpoint;
          return false;
        }
        throw this.#makeError("Incomplete table header");
      }
      const isArrayTable = this.#buffer[this.#pos + 1] === "[";
      this.#pos += isArrayTable ? 2 : 1;
      const path = this.#readKeyPath(isFlush);
      if (path === NEED_MORE) {
        this.#pos = checkpoint;
        return false;
      }
      this.#skipHorizontalWhitespace();
      if (isArrayTable) {
        if (this.#pos + 1 >= this.#buffer.length) {
          if (!isFlush) {
            this.#pos = checkpoint;
            return false;
          }
          throw this.#makeError("Expected ']]' to close array of tables header");
        }
        if (this.#buffer[this.#pos] !== "]" || this.#buffer[this.#pos + 1] !== "]") {
          throw this.#makeError("Expected ']]' to close array of tables header");
        }
        this.#pos += 2;
      }
      else {
        if (this.#pos >= this.#buffer.length) {
          throw this.#makeError("Expected ']' to close table header");
        }
        if (this.#buffer[this.#pos] !== "]") {
          throw this.#makeError("Expected ']' to close table header");
        }
        this.#pos += 1;
      }

      if (isArrayTable) {
        this.#handler.onArrayTable?.(new ArrayTableEvent(path));
      }
      else {
        this.#handler.onTable?.(new TableEvent(path));
      }
      this.#topState = "afterValue";
      return true;
    }

    const path = this.#readKeyPath(isFlush);
    if (path === NEED_MORE) {
      this.#pos = checkpoint;
      return false;
    }
    if (this.#pos >= this.#buffer.length) {
      throw this.#makeError("Expected '=' after key");
    }
    if (this.#buffer[this.#pos] !== "=") {
      throw this.#makeError(`Expected '=' after key, got ${JSON.stringify(this.#buffer[this.#pos])}`);
    }
    this.#pos++;
    this.#handler.onKey?.(new KeyEvent(path));
    this.#topState = "expectValue";
    return true;
  }

  #stepExpectValue(isFlush: boolean): boolean {
    const checkpoint = this.#pos;
    this.#skipHorizontalWhitespace();
    if (this.#pos >= this.#buffer.length) {
      if (!isFlush) {
        this.#pos = checkpoint;
        return false;
      }
      throw this.#makeError("Expected value after '='");
    }

    const res = this.#readValueStart(isFlush);
    if (res === NEED_MORE) {
      this.#pos = checkpoint;
      return false;
    }
    if (res === "container") {
      return true;
    }
    this.#handler.onValue?.(res);
    this.#topState = "afterValue";
    return true;
  }

  #stepAfterValue(isFlush: boolean): boolean {
    const checkpoint = this.#pos;
    this.#skipHorizontalWhitespace();
    if (this.#pos >= this.#buffer.length) {
      if (!isFlush) {
        this.#pos = checkpoint;
        return false;
      }
      this.#topState = "lineStart";
      return false;
    }
    const ch = this.#buffer[this.#pos];
    if (ch === "#") {
      const comment = this.#readComment(isFlush);
      if (comment === NEED_MORE) {
        this.#pos = checkpoint;
        return false;
      }
      if (this.#comments) {
        this.#handler.onComment?.(new CommentEvent(comment));
      }
      this.#topState = "lineStart";
      return true;
    }
    const nl = this.#tryConsumeNewline(isFlush);
    if (nl === NEED_MORE) {
      this.#pos = checkpoint;
      return false;
    }
    if (nl) {
      this.#topState = "lineStart";
      return true;
    }
    throw this.#makeError(`Unexpected character ${JSON.stringify(ch)} after value`);
  }

  #stepArray(frame: Extract<ContainerFrame, { type: "array" }>, isFlush: boolean): boolean {
    const checkpoint = this.#pos;
    if (!this.#skipArrayWhitespaceAndComments(isFlush)) {
      this.#pos = checkpoint;
      return false;
    }
    if (this.#pos >= this.#buffer.length) {
      if (!isFlush) {
        this.#pos = checkpoint;
        return false;
      }
      throw this.#makeError("Unterminated array");
    }

    const ch = this.#buffer[this.#pos];
    if (frame.expect === "valueOrEnd") {
      if (ch === "]") {
        this.#pos++;
        this.#stack.pop();
        this.#handler.onEndArray?.(new EndArrayEvent());
        this.#onContainerClosed();
        return true;
      }
      const res = this.#readValueStart(isFlush);
      if (res === NEED_MORE) {
        this.#pos = checkpoint;
        return false;
      }
      frame.expect = "commaOrEnd";
      if (res !== "container") {
        this.#handler.onValue?.(res);
      }
      return true;
    }

    if (ch === ",") {
      this.#pos++;
      frame.expect = "valueOrEnd";
      return true;
    }
    if (ch === "]") {
      this.#pos++;
      this.#stack.pop();
      this.#handler.onEndArray?.(new EndArrayEvent());
      this.#onContainerClosed();
      return true;
    }
    throw this.#makeError(`Expected ',' or ']' in array, got ${JSON.stringify(ch)}`);
  }

  #stepInlineTable(frame: Extract<ContainerFrame, { type: "inlineTable" }>, isFlush: boolean): boolean {
    const checkpoint = this.#pos;
    this.#skipHorizontalWhitespace();
    if (this.#pos >= this.#buffer.length) {
      if (!isFlush) {
        this.#pos = checkpoint;
        return false;
      }
      throw this.#makeError("Unterminated inline table");
    }

    const ch = this.#buffer[this.#pos];
    if (frame.expect === "keyOrValue") {
      if (ch === "}") {
        this.#pos++;
        this.#stack.pop();
        this.#handler.onEndInlineTable?.(new EndInlineTableEvent());
        this.#onContainerClosed();
        return true;
      }
      const path = this.#readKeyPath(isFlush);
      if (path === NEED_MORE) {
        this.#pos = checkpoint;
        return false;
      }
      if (this.#pos >= this.#buffer.length) {
        throw this.#makeError("Expected '=' in inline table");
      }
      if (this.#buffer[this.#pos] !== "=") {
        throw this.#makeError(`Expected '=' in inline table, got ${JSON.stringify(this.#buffer[this.#pos])}`);
      }
      this.#pos++;
      frame.expect = "value";
      this.#handler.onKey?.(new KeyEvent(path));
      return true;
    }

    if (frame.expect === "value") {
      const res = this.#readValueStart(isFlush);
      if (res === NEED_MORE) {
        this.#pos = checkpoint;
        return false;
      }
      frame.expect = "commaOrEnd";
      if (res !== "container") {
        this.#handler.onValue?.(res);
      }
      return true;
    }

    if (ch === ",") {
      this.#pos++;
      frame.expect = "keyOrValue";
      return true;
    }
    if (ch === "}") {
      this.#pos++;
      this.#stack.pop();
      this.#handler.onEndInlineTable?.(new EndInlineTableEvent());
      this.#onContainerClosed();
      return true;
    }
    throw this.#makeError(`Expected ',' or '}' in inline table, got ${JSON.stringify(ch)}`);
  }

  #onContainerClosed(): void {
    if (this.#stack.length === 0) {
      this.#topState = "afterValue";
    }
  }

  #readValueStart(isFlush: boolean): ValueEvent | "container" | typeof NEED_MORE {
    const ch = this.#buffer[this.#pos];
    if (ch === "[") {
      this.#pos++;
      this.#stack.push({ type: "array", expect: "valueOrEnd" });
      this.#handler.onStartArray?.(new StartArrayEvent());
      return "container";
    }
    if (ch === "{") {
      this.#pos++;
      this.#stack.push({ type: "inlineTable", expect: "keyOrValue" });
      this.#handler.onStartInlineTable?.(new StartInlineTableEvent());
      return "container";
    }
    if (ch === "\"") {
      const str = this.#readBasicOrMultilineString(isFlush);
      if (str === NEED_MORE) return NEED_MORE;
      return new ValueEvent("string", str);
    }
    if (ch === "'") {
      const str = this.#readLiteralOrMultilineString(isFlush);
      if (str === NEED_MORE) return NEED_MORE;
      return new ValueEvent("string", str);
    }
    return this.#readBareScalar(isFlush);
  }

  #readKeyPath(isFlush: boolean): string[] | typeof NEED_MORE {
    const path: string[] = [];
    while (true) {
      this.#skipHorizontalWhitespace();
      if (this.#pos >= this.#buffer.length) {
        return isFlush ? this.#throwUnexpectedKeyEnd() : NEED_MORE;
      }
      const ch = this.#buffer[this.#pos];
      let seg: string | typeof NEED_MORE;
      if (ch === "\"") {
        seg = this.#readBasicString(isFlush);
      }
      else if (ch === "'") {
        seg = this.#readLiteralString(isFlush);
      }
      else {
        seg = this.#readBareKey(isFlush);
      }
      if (seg === NEED_MORE) return NEED_MORE;
      path.push(seg);

      this.#skipHorizontalWhitespace();
      if (this.#pos >= this.#buffer.length) {
        return isFlush ? path : NEED_MORE;
      }
      if (this.#buffer[this.#pos] === ".") {
        this.#pos++;
        continue;
      }
      return path;
    }
  }

  #throwUnexpectedKeyEnd(): never {
    throw this.#makeError("Unexpected end of input while reading key");
  }

  #readBareKey(isFlush: boolean): string | typeof NEED_MORE {
    const start = this.#pos;
    while (this.#pos < this.#buffer.length && BARE_KEY_CHAR.test(this.#buffer[this.#pos])) {
      this.#pos++;
    }
    if (this.#pos === start) {
      throw this.#makeError(`Invalid key character ${JSON.stringify(this.#buffer[this.#pos])}`);
    }
    if (this.#pos >= this.#buffer.length && !isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }
    return this.#buffer.slice(start, this.#pos);
  }

  #readBasicOrMultilineString(isFlush: boolean): string | typeof NEED_MORE {
    if (this.#pos + 2 >= this.#buffer.length) {
      if (!isFlush) return NEED_MORE;
      return this.#readBasicString(isFlush);
    }
    if (this.#buffer[this.#pos + 1] === "\"" && this.#buffer[this.#pos + 2] === "\"") {
      return this.#readMultilineBasicString(isFlush);
    }
    return this.#readBasicString(isFlush);
  }

  #readLiteralOrMultilineString(isFlush: boolean): string | typeof NEED_MORE {
    if (this.#pos + 2 >= this.#buffer.length) {
      if (!isFlush) return NEED_MORE;
      return this.#readLiteralString(isFlush);
    }
    if (this.#buffer[this.#pos + 1] === "'" && this.#buffer[this.#pos + 2] === "'") {
      return this.#readMultilineLiteralString(isFlush);
    }
    return this.#readLiteralString(isFlush);
  }

  #readBasicString(isFlush: boolean): string | typeof NEED_MORE {
    const start = this.#pos;
    this.#pos++; // skip opening '"'
    let out = "";
    while (this.#pos < this.#buffer.length) {
      const ch = this.#buffer[this.#pos++];
      if (ch === "\"") {
        return out;
      }
      if (ch === "\n" || ch === "\r") {
        throw this.#makeError("Newline is not allowed in single-line basic string");
      }
      if (ch === "\\") {
        const esc = this.#readEscape(isFlush);
        if (esc === NEED_MORE) {
          this.#pos = start;
          return NEED_MORE;
        }
        out += esc;
        continue;
      }
      out += ch;
    }
    if (!isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }
    throw this.#makeError("Unterminated basic string");
  }

  #readMultilineBasicString(isFlush: boolean): string | typeof NEED_MORE {
    const start = this.#pos;
    this.#pos += 3; // skip '"""'
    // Trim immediate newline after opening delimiter
    if (this.#pos < this.#buffer.length && this.#buffer[this.#pos] === "\r") {
      if (this.#pos + 1 >= this.#buffer.length) {
        if (!isFlush) {
          this.#pos = start;
          return NEED_MORE;
        }
      }
      else if (this.#buffer[this.#pos + 1] === "\n") {
        this.#pos += 2;
      }
    }
    else if (this.#pos < this.#buffer.length && this.#buffer[this.#pos] === "\n") {
      this.#pos++;
    }
    else if (this.#pos >= this.#buffer.length && !isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }

    let out = "";
    while (this.#pos < this.#buffer.length) {
      const ch = this.#buffer[this.#pos];
      if (ch === "\"") {
        // Count consecutive quotes (up to 5 allowed: 1-2 content quotes + 3 closing)
        let quotes = 0;
        while (this.#pos + quotes < this.#buffer.length && this.#buffer[this.#pos + quotes] === "\"" && quotes < 6) {
          quotes++;
        }
        if (this.#pos + quotes >= this.#buffer.length && !isFlush && quotes <= 5) {
          this.#pos = start;
          return NEED_MORE;
        }
        if (quotes >= 3 && quotes <= 5) {
          out += "\"".repeat(quotes - 3);
          this.#pos += quotes;
          return out;
        }
        if (quotes > 5) {
          throw this.#makeError("Too many consecutive quotes in multiline basic string");
        }
        out += "\"";
        this.#pos++;
        continue;
      }
      if (ch === "\r") {
        if (this.#pos + 1 >= this.#buffer.length) {
          if (!isFlush) {
            this.#pos = start;
            return NEED_MORE;
          }
          throw this.#makeError("Bare CR in multiline basic string");
        }
        if (this.#buffer[this.#pos + 1] === "\n") {
          out += "\n";
          this.#pos += 2;
          continue;
        }
        throw this.#makeError("Bare CR in multiline basic string");
      }
      if (ch === "\\") {
        this.#pos++;
        if (this.#pos >= this.#buffer.length) {
          if (!isFlush) {
            this.#pos = start;
            return NEED_MORE;
          }
          throw this.#makeError("Unterminated escape in multiline basic string");
        }
        const next = this.#buffer[this.#pos];
        if (next === " " || next === "\t" || next === "\n" || next === "\r") {
          // Line-ending backslash trims whitespace and newlines
          const beforeTrim = this.#pos;
          let sawNewline = false;
          while (this.#pos < this.#buffer.length) {
            const c = this.#buffer[this.#pos];
            if (c === " " || c === "\t") {
              this.#pos++;
            }
            else if (c === "\n") {
              sawNewline = true;
              this.#pos++;
            }
            else if (c === "\r") {
              if (this.#pos + 1 >= this.#buffer.length) {
                if (!isFlush) {
                  this.#pos = start;
                  return NEED_MORE;
                }
                throw this.#makeError("Bare CR in line-ending backslash");
              }
              if (this.#buffer[this.#pos + 1] === "\n") {
                sawNewline = true;
                this.#pos += 2;
              }
              else {
                throw this.#makeError("Bare CR in line-ending backslash");
              }
            }
            else {
              break;
            }
          }
          if (this.#pos >= this.#buffer.length && !isFlush) {
            this.#pos = start;
            return NEED_MORE;
          }
          if (!sawNewline) {
            this.#pos = beforeTrim;
            throw this.#makeError("Invalid escape sequence after '\\'");
          }
          continue;
        }
        const esc = this.#readEscape(isFlush);
        if (esc === NEED_MORE) {
          this.#pos = start;
          return NEED_MORE;
        }
        out += esc;
        continue;
      }
      out += ch;
      this.#pos++;
    }
    if (!isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }
    throw this.#makeError("Unterminated multiline basic string");
  }

  #readEscape(isFlush: boolean): string | typeof NEED_MORE {
    if (this.#pos >= this.#buffer.length) {
      if (!isFlush) return NEED_MORE;
      throw this.#makeError("Unterminated escape sequence");
    }
    const esc = this.#buffer[this.#pos++];
    switch (esc) {
      case "b": return "\b";
      case "t": return "\t";
      case "n": return "\n";
      case "f": return "\f";
      case "r": return "\r";
      case "\"": return "\"";
      case "\\": return "\\";
      case "u":
      case "U": {
        const len = esc === "u" ? 4 : 8;
        if (this.#pos + len > this.#buffer.length) {
          if (!isFlush) return NEED_MORE;
          throw this.#makeError(`Incomplete \\${esc} escape sequence`);
        }
        const hex = this.#buffer.slice(this.#pos, this.#pos + len);
        if (!/^[0-9A-Fa-f]+$/.test(hex)) {
          throw this.#makeError(`Invalid unicode escape \\${esc}${hex}`);
        }
        this.#pos += len;
        const cp = Number.parseInt(hex, 16);
        if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
          throw this.#makeError(`Invalid unicode scalar value \\${esc}${hex}`);
        }
        return String.fromCodePoint(cp);
      }
      default:
        throw this.#makeError(`Unknown escape sequence \\${esc}`);
    }
  }

  #readLiteralString(isFlush: boolean): string | typeof NEED_MORE {
    const start = this.#pos;
    this.#pos++; // skip opening '\''
    const contentStart = this.#pos;
    while (this.#pos < this.#buffer.length) {
      const ch = this.#buffer[this.#pos];
      if (ch === "'") {
        const res = this.#buffer.slice(contentStart, this.#pos);
        this.#pos++;
        return res;
      }
      if (ch === "\n" || ch === "\r") {
        throw this.#makeError("Newline is not allowed in single-line literal string");
      }
      this.#pos++;
    }
    if (!isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }
    throw this.#makeError("Unterminated literal string");
  }

  #readMultilineLiteralString(isFlush: boolean): string | typeof NEED_MORE {
    const start = this.#pos;
    this.#pos += 3; // skip '\'\'\''
    if (this.#pos < this.#buffer.length && this.#buffer[this.#pos] === "\r") {
      if (this.#pos + 1 >= this.#buffer.length) {
        if (!isFlush) {
          this.#pos = start;
          return NEED_MORE;
        }
      }
      else if (this.#buffer[this.#pos + 1] === "\n") {
        this.#pos += 2;
      }
    }
    else if (this.#pos < this.#buffer.length && this.#buffer[this.#pos] === "\n") {
      this.#pos++;
    }
    else if (this.#pos >= this.#buffer.length && !isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }

    let out = "";
    while (this.#pos < this.#buffer.length) {
      const ch = this.#buffer[this.#pos];
      if (ch === "'") {
        let quotes = 0;
        while (this.#pos + quotes < this.#buffer.length && this.#buffer[this.#pos + quotes] === "'" && quotes < 6) {
          quotes++;
        }
        if (this.#pos + quotes >= this.#buffer.length && !isFlush && quotes <= 5) {
          this.#pos = start;
          return NEED_MORE;
        }
        if (quotes >= 3 && quotes <= 5) {
          out += "'".repeat(quotes - 3);
          this.#pos += quotes;
          return out;
        }
        if (quotes > 5) {
          throw this.#makeError("Too many consecutive quotes in multiline literal string");
        }
        out += "'";
        this.#pos++;
        continue;
      }
      if (ch === "\r") {
        if (this.#pos + 1 >= this.#buffer.length) {
          if (!isFlush) {
            this.#pos = start;
            return NEED_MORE;
          }
          throw this.#makeError("Bare CR in multiline literal string");
        }
        if (this.#buffer[this.#pos + 1] === "\n") {
          out += "\n";
          this.#pos += 2;
          continue;
        }
        throw this.#makeError("Bare CR in multiline literal string");
      }
      out += ch;
      this.#pos++;
    }
    if (!isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }
    throw this.#makeError("Unterminated multiline literal string");
  }

  #readBareScalar(isFlush: boolean): ValueEvent | typeof NEED_MORE {
    const start = this.#pos;
    // Allow space in date-time (e.g. "1979-05-27 07:32:00Z") only when followed by digit
    while (this.#pos < this.#buffer.length) {
      const ch = this.#buffer[this.#pos];
      if (ch === "," || ch === "]" || ch === "}" || ch === "#" || ch === "\n" || ch === "\r" || ch === "\t") {
        break;
      }
      if (ch === " ") {
        const rawSoFar = this.#buffer.slice(start, this.#pos);
        if (LOCAL_DATE_REGEX.test(rawSoFar)) {
          if (this.#pos + 1 >= this.#buffer.length) {
            if (!isFlush) {
              this.#pos = start;
              return NEED_MORE;
            }
            break;
          }
          if (/\d/.test(this.#buffer[this.#pos + 1])) {
            this.#pos++;
            continue;
          }
        }
        break;
      }
      this.#pos++;
    }

    if (this.#pos >= this.#buffer.length && !isFlush) {
      this.#pos = start;
      return NEED_MORE;
    }

    const raw = this.#buffer.slice(start, this.#pos);
    if (raw.length === 0) {
      throw this.#makeError(`Unexpected character ${JSON.stringify(this.#buffer[this.#pos])}`);
    }

    return this.#parseBareScalarToken(raw);
  }

  #parseBareScalarToken(raw: string): ValueEvent {
    if (raw === "true") return this.#makeValue("boolean", true);
    if (raw === "false") return this.#makeValue("boolean", false);
    if (raw === "inf" || raw === "+inf") return this.#makeValue("float", Infinity);
    if (raw === "-inf") return this.#makeValue("float", -Infinity);
    if (raw === "nan" || raw === "+nan" || raw === "-nan") return this.#makeValue("float", Number.NaN);

    if (OFFSET_DATETIME_REGEX.test(raw)) return this.#makeValue("offsetDateTime", raw);
    if (LOCAL_DATETIME_REGEX.test(raw)) return this.#makeValue("localDateTime", raw);
    if (LOCAL_DATE_REGEX.test(raw)) return this.#makeValue("localDate", raw);
    if (LOCAL_TIME_REGEX.test(raw)) return this.#makeValue("localTime", raw);

    if (DEC_INT_REGEX.test(raw)) {
      return this.#makeValue("integer", Number(raw.replaceAll("_", "")));
    }
    if (HEX_INT_REGEX.test(raw)) {
      return this.#makeValue("integer", Number.parseInt(raw.slice(2).replaceAll("_", ""), 16));
    }
    if (OCT_INT_REGEX.test(raw)) {
      return this.#makeValue("integer", Number.parseInt(raw.slice(2).replaceAll("_", ""), 8));
    }
    if (BIN_INT_REGEX.test(raw)) {
      return this.#makeValue("integer", Number.parseInt(raw.slice(2).replaceAll("_", ""), 2));
    }
    if (FLOAT_REGEX.test(raw)) {
      return this.#makeValue("float", Number(raw.replaceAll("_", "")));
    }

    throw this.#makeError(`Invalid TOML value: ${JSON.stringify(raw)}`);
  }

  #makeValue<VT extends ValueType>(type: VT, value: ValueDictionary[VT]): ValueEvent<VT> {
    return new ValueEvent(type, value);
  }
}
