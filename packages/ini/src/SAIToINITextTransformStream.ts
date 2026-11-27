import type { SAIEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

const summarize = Object.freeze({
  /** default type: minimal (emit per event) */
  default: "default",
  /** Emit per section */
  section: "section",
  /** Emit per document (from `startDocument` to `endDocument`) */
  document: "document",
} as const);
type Summarize = typeof summarize[keyof typeof summarize];

/**
 * Configuration options for `SAIToINITextTransformStream`.
 */
export type SAIToINITextTransformStreamOptions = {
  /** Key-value delimiter string (default: `"="`). */
  delimiter?: string
  /** Default comment prefix when a `comment` event has no `prefix` property (default: `";"`). */
  commentPrefix?: string
  /** Emit `comment` events as comment lines (default: `false`). */
  comments?: boolean
  /** Line break string appended after each line (default: `"\n"`). */
  lineBreak?: string
  /** Output granularity: `"default"` (`false`), `"section"`, or `"document"` (`true`). */
  summarize?: boolean | Summarize
};

type Status = {
  get options(): SAIToINITextTransformStreamOptions | undefined
  get inDocument(): boolean
  get summarize(): Summarize
  get parts(): string[]
};

/**
 * Error thrown by `SAIToINITextTransformStream` when an invalid SAI event sequence or option is encountered.
 */
export class SAIToINITextTransformStreamError extends Error implements Status {
  options: SAIToINITextTransformStreamOptions | undefined;
  inDocument: boolean;
  summarize: Summarize;
  parts: string[];

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAIToINITextTransformStreamError";
    ({
      options: this.options,
      inDocument: this.inDocument,
      summarize: this.summarize,
      parts: this.parts,
    } = status);
  }
}

function escapeDoubleQuoted(value: string): string {
  let out = "\"";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    switch (ch) {
      case "\\":
        out += "\\\\";
        break;
      case "\"":
        out += "\\\"";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\0":
        out += "\\0";
        break;
      default:
        out += ch;
        break;
    }
  }
  out += "\"";
  return out;
}

function formatValue(value: string): string {
  if (value.length === 0) return "";
  const needsQuote
    = value !== value.trim()
      || value.startsWith("\"")
      || value.startsWith("'")
      || value.includes("\n")
      || value.includes("\r")
      || value.includes("\0");
  return needsQuote ? escapeDoubleQuoted(value) : value;
}

/**
 * A `TransformStream` that serializes SAI events back into INI text.
 */
export class SAIToINITextTransformStream extends TransformStream<SAIEventInterface, string> {
  #options: SAIToINITextTransformStreamOptions | undefined;
  #delimiter: string;
  #commentPrefix: string;
  #comments: boolean;
  #lineBreak: string;
  #summarize: Summarize;
  #inDocument = false;
  #parts: string[] = [];
  #controller!: TransformStreamDefaultController<string>;

  constructor(options?: SAIToINITextTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<string>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#transform(chunk);
      },
      flush: () => {
        this.#flush();
      },
    });
    this.#controller = controller_;
    this.#options = options;
    this.#delimiter = options?.delimiter ?? "=";
    this.#commentPrefix = options?.commentPrefix ?? ";";
    this.#comments = options?.comments ?? false;
    this.#lineBreak = options?.lineBreak ?? "\n";
    this.#summarize = options?.summarize === true
      ? summarize.document
      : options?.summarize === false || options?.summarize === undefined
        ? summarize.default
        : options.summarize;

    if (this.#delimiter.length === 0) {
      throw this.#makeError("delimiter must not be empty");
    }
  }

  #status(): Status {
    return {
      options: this.#options,
      inDocument: this.#inDocument,
      summarize: this.#summarize,
      parts: this.#parts.slice(),
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: string | Error, options?: ErrorOptions): SAIToINITextTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SAIToINITextTransformStreamError(message, this.#status(), options);
  }

  #flushParts(): void {
    if (this.#parts.length > 0) {
      this.#controller.enqueue(this.#parts.join(""));
      this.#parts = [];
    }
  }

  #emit(text: string): void {
    if (this.#summarize === summarize.default) {
      this.#controller.enqueue(text);
    }
    else {
      this.#parts.push(text);
    }
  }

  #transform(event: SAIEventInterface): void {
    switch (event.name) {
      case "startDocument":
        if (this.#inDocument) {
          throw this.#makeError("Unexpected startDocument while already in document");
        }
        this.#inDocument = true;
        break;
      case "endDocument":
        if (!this.#inDocument) {
          throw this.#makeError("Unexpected endDocument outside document");
        }
        this.#inDocument = false;
        this.#flushParts();
        break;
      case "comment":
        if (this.#comments) {
          const prefix = event.prefix ?? this.#commentPrefix;
          this.#emit(`${prefix}${event.comment}${this.#lineBreak}`);
        }
        break;
      case "section": {
        if (event.section.length === 0 || event.section.includes("]") || event.section.includes("\n") || event.section.includes("\r")) {
          throw this.#makeError(`Invalid INI section name: ${JSON.stringify(event.section)}`);
        }
        if (this.#summarize === summarize.section) {
          this.#flushParts();
        }
        this.#emit(`[${event.section}]${this.#lineBreak}`);
        break;
      }
      case "entry": {
        if (event.key.length === 0 || event.key.includes("\n") || event.key.includes("\r")) {
          throw this.#makeError(`Invalid INI entry key: ${JSON.stringify(event.key)}`);
        }
        this.#emit(`${event.key}${this.#delimiter}${formatValue(event.value)}${this.#lineBreak}`);
        break;
      }
    }
  }

  #flush(): void {
    this.#flushParts();
  }
}
