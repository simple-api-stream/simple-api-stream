import type { SimpleApiParser } from "@simple-api-stream/core";
import {
  CommentEvent,
  EndDocumentEvent,
  EntryEvent,
  SectionEvent,
  StartDocumentEvent,
} from "./event/index.js";
import type { SAIHandler } from "./interface/index.js";
import { toErrorMessage } from "./utils/index.js";

/**
 * Configuration options for `INITextToSAIParser`.
 */
export type INITextToSAIParserOptions = {
  /** Do not emit `startDocument` / `endDocument` events (default: `false`). */
  skipDocument?: boolean
  /** Emit `comment` events for comment lines (default: `false`). */
  comments?: boolean
  /** Prefixes recognized as comment markers (default: `[";", "#"]`). */
  commentPrefixes?: readonly string[]
  /** Delimiters separating keys and values (default: `["="]`). */
  delimiters?: readonly string[]
  /** Recognize inline comments inside unquoted entry values (default: `false`). */
  inlineComments?: boolean
  /** Strip a leading UTF-8 BOM (`\uFEFF`) if present (default: `true`). */
  stripBom?: boolean
};

/**
 * Optional debug lifecycle hooks for `INITextToSAIParser`.
 */
export type INITextToSAIParserAdditionalHandler = {
  onParseBefore: (status: Status) => void
  onParseAfter: (status: Status) => void
  onParseLoopBefore: (status: Status) => void
  onParseLoopAfter: (status: Status) => void
};

type Status = {
  get options(): INITextToSAIParserOptions
  get buffer(): string
  get line(): number
  get eof(): boolean
};

/**
 * Error thrown by `INITextToSAIParser` when malformed INI syntax or invalid options are encountered.
 */
export class INITextToSAIParserError extends Error implements Status {
  options: INITextToSAIParserOptions;
  buffer: string;
  line: number;
  eof: boolean;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "INITextToSAIParserError";
    ({
      options: this.options,
      buffer: this.buffer,
      line: this.line,
      eof: this.eof,
    } = status);
  }
}

const DEFAULT_COMMENT_PREFIXES = [";", "#"] as const;
const DEFAULT_DELIMITERS = ["="] as const;

function matchPrefix(text: string, prefixes: readonly string[]): string | undefined {
  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) return prefix;
  }
  return undefined;
}

function findEarliestDelimiter(text: string, delimiters: readonly string[]): { index: number, delimiter: string } | undefined {
  let bestIndex = -1;
  let bestDelimiter = "";
  for (const delimiter of delimiters) {
    const idx = text.indexOf(delimiter);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex || (idx === bestIndex && delimiter.length > bestDelimiter.length))) {
      bestIndex = idx;
      bestDelimiter = delimiter;
    }
  }
  if (bestIndex === -1) return undefined;
  return { index: bestIndex, delimiter: bestDelimiter };
}

function unescapeDoubleQuoted(raw: string): { value: string, endIndex: number } | undefined {
  let out = "";
  let i = 1; // skip opening "
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\"") {
      return { value: out, endIndex: i + 1 };
    }
    if (ch === "\\") {
      i++;
      if (i >= raw.length) return undefined;
      const esc = raw[i];
      switch (esc) {
        case "n":
          out += "\n";
          break;
        case "r":
          out += "\r";
          break;
        case "t":
          out += "\t";
          break;
        case "0":
          out += "\0";
          break;
        case "\\":
          out += "\\";
          break;
        case "\"":
          out += "\"";
          break;
        default:
          out += esc;
          break;
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return undefined;
}

function parseSingleQuoted(raw: string): { value: string, endIndex: number } | undefined {
  const closeIdx = raw.indexOf("'", 1);
  if (closeIdx === -1) return undefined;
  return { value: raw.slice(1, closeIdx), endIndex: closeIdx + 1 };
}

/**
 * Incremental streaming INI parser that emits SAI (Simple API for INI) events to a handler.
 */
export class INITextToSAIParser implements SimpleApiParser<string> {
  #handler: Partial<SAIHandler & INITextToSAIParserAdditionalHandler>;
  #options: INITextToSAIParserOptions;
  #skipDocument: boolean;
  #comments: boolean;
  #commentPrefixes: string[];
  #delimiters: string[];
  #inlineComments: boolean;
  #stripBom: boolean;

  #buffer = "";
  #line = 0;
  #eof = false;
  #started = false;
  #bomChecked = false;
  #errored = false;

  constructor(
    options: INITextToSAIParserOptions & {
      handler?: Partial<SAIHandler & INITextToSAIParserAdditionalHandler>
    } = {},
  ) {
    const { handler, ...parserOptions } = options;
    this.#handler = handler ?? {};
    this.#options = parserOptions;
    this.#skipDocument = parserOptions.skipDocument ?? false;
    this.#comments = parserOptions.comments ?? false;
    this.#inlineComments = parserOptions.inlineComments ?? false;
    this.#stripBom = parserOptions.stripBom ?? true;

    const rawCommentPrefixes = parserOptions.commentPrefixes ?? DEFAULT_COMMENT_PREFIXES;
    if (rawCommentPrefixes.some(p => p.length === 0)) {
      throw this.#makeError("commentPrefixes must not contain empty strings");
    }
    this.#commentPrefixes = [...rawCommentPrefixes].sort((a, b) => b.length - a.length);

    const rawDelimiters = parserOptions.delimiters ?? DEFAULT_DELIMITERS;
    if (rawDelimiters.length === 0 || rawDelimiters.some(d => d.length === 0)) {
      throw this.#makeError("delimiters must contain at least one non-empty string");
    }
    this.#delimiters = [...rawDelimiters];
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

  #makeError(message: unknown, options?: ErrorOptions): INITextToSAIParserError {
    ({ message, options } = toErrorMessage(message, options));
    return new INITextToSAIParserError(message as string, this.#status(), options);
  }

  #ensureStarted(): void {
    if (!this.#started) {
      this.#started = true;
      if (!this.#skipDocument) {
        this.#handler.onStartDocument?.(new StartDocumentEvent());
      }
    }
  }

  /**
   * Feeds a chunk of INI text into the parser.
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
   * Signals the end of the INI input stream and flushes any remaining buffered line.
   */
  flush(): void {
    if (this.#errored || this.#eof) return;
    this.#eof = true;
    this.#parse();
    if (!this.#errored) {
      this.#ensureStarted();
      if (!this.#skipDocument) {
        this.#handler.onEndDocument?.(new EndDocumentEvent());
      }
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

  #parse(): void {
    this.#handler.onParseBefore?.(this.#status());
    try {
      this.#ensureStarted();

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
            // Wait for next chunk to see if \n follows \r
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
        if (this.#errored) return;
      }
    }
    catch (err: unknown) {
      this.#reportError(err instanceof INITextToSAIParserError ? err : this.#makeError(err));
    }
    finally {
      this.#handler.onParseAfter?.(this.#status());
    }
  }

  #parseLine(rawLine: string): void {
    const trimmedLeft = rawLine.trimStart();
    if (trimmedLeft.length === 0) return;

    const commentPrefix = matchPrefix(trimmedLeft, this.#commentPrefixes);
    if (commentPrefix !== undefined) {
      if (this.#comments) {
        this.#handler.onComment?.(new CommentEvent(trimmedLeft.slice(commentPrefix.length), commentPrefix));
      }
      return;
    }

    if (trimmedLeft.startsWith("[")) {
      const closeIdx = trimmedLeft.indexOf("]", 1);
      if (closeIdx === -1) {
        throw this.#makeError(`Unterminated section header at line ${this.#line}`);
      }
      const sectionName = trimmedLeft.slice(1, closeIdx).trim();
      if (sectionName.length === 0) {
        throw this.#makeError(`Empty section name at line ${this.#line}`);
      }
      const trailing = trimmedLeft.slice(closeIdx + 1).trimStart();
      let trailingComment: { comment: string, prefix: string } | undefined;
      if (trailing.length > 0) {
        const trailingPrefix = matchPrefix(trailing, this.#commentPrefixes);
        if (trailingPrefix === undefined) {
          throw this.#makeError(`Unexpected trailing characters after section header at line ${this.#line}`);
        }
        trailingComment = {
          comment: trailing.slice(trailingPrefix.length),
          prefix: trailingPrefix,
        };
      }
      this.#handler.onSection?.(new SectionEvent(sectionName));
      if (trailingComment && this.#comments) {
        this.#handler.onComment?.(new CommentEvent(trailingComment.comment, trailingComment.prefix));
      }
      return;
    }

    const delimMatch = findEarliestDelimiter(trimmedLeft, this.#delimiters);
    if (delimMatch === undefined) {
      throw this.#makeError(`Expected delimiter in entry at line ${this.#line}`);
    }

    const key = trimmedLeft.slice(0, delimMatch.index).trim();
    if (key.length === 0) {
      throw this.#makeError(`Empty key in entry at line ${this.#line}`);
    }

    const rawValue = trimmedLeft.slice(delimMatch.index + delimMatch.delimiter.length).trimStart();
    let value: string;
    let trailingComment: { comment: string, prefix: string } | undefined;

    if (rawValue.startsWith("\"")) {
      const parsed = unescapeDoubleQuoted(rawValue);
      if (parsed === undefined) {
        throw this.#makeError(`Unterminated double-quoted value at line ${this.#line}`);
      }
      value = parsed.value;
      const trailing = rawValue.slice(parsed.endIndex).trimStart();
      if (trailing.length > 0) {
        const trailingPrefix = matchPrefix(trailing, this.#commentPrefixes);
        if (trailingPrefix === undefined) {
          throw this.#makeError(`Unexpected trailing characters after quoted value at line ${this.#line}`);
        }
        trailingComment = {
          comment: trailing.slice(trailingPrefix.length),
          prefix: trailingPrefix,
        };
      }
    }
    else if (rawValue.startsWith("'")) {
      const parsed = parseSingleQuoted(rawValue);
      if (parsed === undefined) {
        throw this.#makeError(`Unterminated single-quoted value at line ${this.#line}`);
      }
      value = parsed.value;
      const trailing = rawValue.slice(parsed.endIndex).trimStart();
      if (trailing.length > 0) {
        const trailingPrefix = matchPrefix(trailing, this.#commentPrefixes);
        if (trailingPrefix === undefined) {
          throw this.#makeError(`Unexpected trailing characters after quoted value at line ${this.#line}`);
        }
        trailingComment = {
          comment: trailing.slice(trailingPrefix.length),
          prefix: trailingPrefix,
        };
      }
    }
    else if (this.#inlineComments && this.#commentPrefixes.length > 0) {
      const inlineMatch = findEarliestDelimiter(rawValue, this.#commentPrefixes);
      if (inlineMatch !== undefined) {
        value = rawValue.slice(0, inlineMatch.index).trimEnd();
        trailingComment = {
          comment: rawValue.slice(inlineMatch.index + inlineMatch.delimiter.length),
          prefix: inlineMatch.delimiter,
        };
      }
      else {
        value = rawValue.trimEnd();
      }
    }
    else {
      value = rawValue.trimEnd();
    }

    this.#handler.onEntry?.(new EntryEvent(key, value));
    if (trailingComment && this.#comments) {
      this.#handler.onComment?.(new CommentEvent(trailingComment.comment, trailingComment.prefix));
    }
  }
}
