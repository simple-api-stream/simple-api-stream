import type { SACEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

const summarize = Object.freeze({
  /** default type: minimal (emit per event) */
  default: "default",
  /** Emit per row (from `startHeaderRow`/`startRecordRow` to `endHeaderRow`/`endRecordRow`) */
  row: "row",
  /** Emit per document (from `startDocument` to `endDocument`) */
  document: "document",
} as const);
type Summarize = typeof summarize[keyof typeof summarize];

/**
 * Policy controlling when CSV fields are enclosed in quotes (`"minimal"` or `"all"`).
 */
export type QuotePolicy = "minimal" | "all";

/**
 * Configuration options for `SACToCSVTextTransformStream`.
 */
export type SACToCSVTextTransformStreamOptions = {
  delimiter?: string
  quote?: string
  lineBreak?: string
  quotePolicy?: QuotePolicy
  summarize?: boolean | Summarize
};

type Status = {
  get options(): SACToCSVTextTransformStreamOptions | undefined
  get inDocument(): boolean
  get inRow(): "header" | "record" | null
  get isFirstColumn(): boolean
  get summarize(): Summarize
  get parts(): string[]
};

/**
 * Error thrown by `SACToCSVTextTransformStream` when an invalid SAC event sequence or option is encountered.
 */
export class SACToCSVTextTransformStreamError extends Error implements Status {
  options: SACToCSVTextTransformStreamOptions | undefined;
  inDocument: boolean;
  inRow: "header" | "record" | null;
  isFirstColumn: boolean;
  summarize: Summarize;
  parts: string[];
  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SACToCSVTextTransformStreamError";
    ({
      options: this.options,
      inDocument: this.inDocument,
      inRow: this.inRow,
      isFirstColumn: this.isFirstColumn,
      summarize: this.summarize,
      parts: this.parts,
    } = status);
  }
}

/**
 * A `TransformStream` that serializes a stream of `SACEventInterface` objects into CSV text.
 */
export class SACToCSVTextTransformStream extends TransformStream<SACEventInterface, string> {
  #options?: SACToCSVTextTransformStreamOptions;
  #delimiter: string;
  #quote: string;
  #escapedQuote: string;
  #lineBreak: string;
  #quotePolicy: QuotePolicy;
  #summarize: Summarize;
  #inDocument = false;
  #inRow: "header" | "record" | null = null;
  #isFirstColumn = true;
  #parts: string[] = [];
  #controller!: TransformStreamDefaultController<string>;

  constructor(options?: SACToCSVTextTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<string>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#enqueue(chunk);
      },
      flush: () => {
        this.#flush();
      },
    });
    this.#options = options;
    this.#delimiter = options?.delimiter ?? ",";
    this.#quote = options?.quote ?? "\"";
    this.#escapedQuote = this.#quote + this.#quote;
    this.#lineBreak = options?.lineBreak ?? "\r\n";
    this.#quotePolicy = options?.quotePolicy ?? "minimal";
    this.#summarize = this.#toSummarize(options?.summarize);
    this.#controller = controller_;

    if (this.#delimiter.length !== 1 || this.#delimiter === "\r" || this.#delimiter === "\n") {
      throw this.#makeError(`Invalid delimiter: ${JSON.stringify(this.#delimiter)}`);
    }
    if (this.#quote.length !== 1 || this.#quote === "\r" || this.#quote === "\n" || this.#quote === this.#delimiter) {
      throw this.#makeError(`Invalid quote: ${JSON.stringify(this.#quote)}`);
    }
  }

  #toSummarize(value?: SACToCSVTextTransformStreamOptions["summarize"]): Summarize {
    if (typeof value === "boolean") return value ? summarize.document : summarize.default;
    if (!value) return summarize.default;
    return value;
  }

  #status(): Status {
    return {
      options: structuredClone(this.#options),
      inDocument: this.#inDocument,
      inRow: this.#inRow,
      isFirstColumn: this.#isFirstColumn,
      summarize: this.#summarize,
      parts: [...this.#parts],
    };
  }

  #makeError(message: unknown, options?: ErrorOptions): SACToCSVTextTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SACToCSVTextTransformStreamError(message as string, this.#status(), options);
  }

  #emit(text: string) {
    if (this.#summarize === summarize.default) {
      if (text.length > 0) this.#controller.enqueue(text);
    }
    else {
      this.#parts.push(text);
    }
  }

  #flushParts() {
    if (this.#parts.length > 0) {
      this.#controller.enqueue(this.#parts.join(""));
      this.#parts = [];
    }
  }

  #formatCell(value: string): string {
    const needsQuote
      = this.#quotePolicy === "all"
        || value.includes(this.#delimiter)
        || value.includes(this.#quote)
        || value.includes("\r")
        || value.includes("\n");
    if (!needsQuote) return value;
    return `${this.#quote}${value.replaceAll(this.#quote, this.#escapedQuote)}${this.#quote}`;
  }

  #enqueue(event: SACEventInterface) {
    switch (event.name) {
      case "startDocument": {
        if (this.#inDocument) {
          throw this.#makeError("Unexpected startDocument inside an open document");
        }
        if (this.#inRow !== null) {
          throw this.#makeError("Unexpected startDocument inside an open row");
        }
        this.#inDocument = true;
        break;
      }
      case "endDocument": {
        if (!this.#inDocument) {
          throw this.#makeError("Unexpected endDocument without matching startDocument");
        }
        if (this.#inRow !== null) {
          throw this.#makeError("Unexpected endDocument while a row is still open");
        }
        this.#inDocument = false;
        if (this.#summarize === summarize.document) {
          this.#flushParts();
        }
        break;
      }
      case "startHeaderRow": {
        if (this.#inRow !== null) {
          throw this.#makeError(`Unexpected startHeaderRow while ${this.#inRow} row is still open`);
        }
        this.#inRow = "header";
        this.#isFirstColumn = true;
        break;
      }
      case "endHeaderRow": {
        if (this.#inRow !== "header") {
          throw this.#makeError("Unexpected endHeaderRow without matching startHeaderRow");
        }
        this.#inRow = null;
        this.#emit(this.#lineBreak);
        if (this.#summarize === summarize.row) {
          this.#flushParts();
        }
        break;
      }
      case "startRecordRow": {
        if (this.#inRow !== null) {
          throw this.#makeError(`Unexpected startRecordRow while ${this.#inRow} row is still open`);
        }
        this.#inRow = "record";
        this.#isFirstColumn = true;
        break;
      }
      case "endRecordRow": {
        if (this.#inRow !== "record") {
          throw this.#makeError("Unexpected endRecordRow without matching startRecordRow");
        }
        this.#inRow = null;
        this.#emit(this.#lineBreak);
        if (this.#summarize === summarize.row) {
          this.#flushParts();
        }
        break;
      }
      case "column": {
        if (this.#inRow === null) {
          throw this.#makeError("Unexpected column outside of a row");
        }
        const prefix = this.#isFirstColumn ? "" : this.#delimiter;
        this.#isFirstColumn = false;
        this.#emit(`${prefix}${this.#formatCell(event.value)}`);
        break;
      }
      default: {
        const exhaustive: never = event;
        throw this.#makeError(`Unknown SAC event: ${String((exhaustive as { name?: unknown }).name)}`);
      }
    }
  }

  #flush() {
    if (this.#inRow !== null) {
      throw this.#makeError(`Stream ended with unclosed ${this.#inRow} row`);
    }
    if (this.#inDocument) {
      throw this.#makeError("Stream ended with unclosed document");
    }
    this.#flushParts();
  }
}
