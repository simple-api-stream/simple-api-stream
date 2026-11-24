import type { SATEventInterface, ValueSATEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

const summarize = Object.freeze({
  /** default type: minimal (emit per event) */
  default: "default",
  /** Emit per document (from `startDocument` to `endDocument`) */
  document: "document",
} as const);
type Summarize = typeof summarize[keyof typeof summarize];

/**
 * Configuration options for `SATToTOMLTextTransformStream`.
 */
export type SATToTOMLTextTransformStreamOptions = {
  lineBreak?: string
  comments?: boolean
  summarize?: boolean | Summarize
};

type ContainerFrame
  = { type: "array", count: number }
    | { type: "inlineTable", count: number };

type Status = {
  get options(): SATToTOMLTextTransformStreamOptions | undefined
  get inDocument(): boolean
  get summarize(): Summarize
  get parts(): string[]
};

/**
 * Error thrown by `SATToTOMLTextTransformStream` when an invalid SAT event sequence or option is encountered.
 */
export class SATToTOMLTextTransformStreamError extends Error implements Status {
  options: SATToTOMLTextTransformStreamOptions | undefined;
  inDocument: boolean;
  summarize: Summarize;
  parts: string[];

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SATToTOMLTextTransformStreamError";
    ({
      options: this.options,
      inDocument: this.inDocument,
      summarize: this.summarize,
      parts: this.parts,
    } = status);
  }
}

const BARE_KEY_REGEX = /^[A-Za-z0-9_-]+$/;

function formatKeySegment(seg: string): string {
  return BARE_KEY_REGEX.test(seg) ? seg : JSON.stringify(seg);
}

function formatKeyPath(path: string[]): string {
  return path.map(formatKeySegment).join(".");
}

function formatValue(event: ValueSATEventInterface): string {
  switch (event.type) {
    case "string":
      return JSON.stringify(event.value);
    case "boolean":
      return event.value ? "true" : "false";
    case "integer":
      return String(event.value);
    case "float": {
      const num = event.value as number;
      if (Number.isNaN(num)) return "nan";
      if (num === Infinity) return "inf";
      if (num === -Infinity) return "-inf";
      return Object.is(num, -0) ? "-0.0" : Number.isInteger(num) ? `${num}.0` : String(num);
    }
    case "offsetDateTime":
    case "localDateTime":
    case "localDate":
    case "localTime":
      return event.value as string;
  }
}

/**
 * A `TransformStream` that serializes SAT events back into TOML text.
 */
export class SATToTOMLTextTransformStream extends TransformStream<SATEventInterface, string> {
  #options: SATToTOMLTextTransformStreamOptions | undefined;
  #lineBreak: string;
  #comments: boolean;
  #summarize: Summarize;
  #inDocument = false;
  #pendingKey = false;
  #stack: ContainerFrame[] = [];
  #parts: string[] = [];
  #controller!: TransformStreamDefaultController<string>;

  constructor(options?: SATToTOMLTextTransformStreamOptions) {
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
    this.#lineBreak = options?.lineBreak ?? "\n";
    this.#comments = options?.comments ?? false;
    this.#summarize = options?.summarize === true
      ? summarize.document
      : options?.summarize === false || options?.summarize === undefined
        ? summarize.default
        : options.summarize;
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

  #makeError(message: string | Error, options?: ErrorOptions): SATToTOMLTextTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SATToTOMLTextTransformStreamError(message, this.#status(), options);
  }

  #emit(text: string): void {
    if (this.#summarize === summarize.document) {
      this.#parts.push(text);
    }
    else {
      this.#controller.enqueue(text);
    }
  }

  #emitLineEndIfTop(): void {
    if (this.#stack.length === 0) {
      this.#emit(this.#lineBreak);
    }
  }

  #beforeValue(): void {
    const top = this.#stack[this.#stack.length - 1];
    if (top?.type === "array") {
      if (top.count > 0) this.#emit(", ");
      top.count++;
    }
    else {
      this.#pendingKey = false;
    }
  }

  #transform(event: SATEventInterface): void {
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
        if (this.#stack.length > 0 || this.#pendingKey) {
          throw this.#makeError("Unexpected endDocument with unclosed container or pending key");
        }
        this.#inDocument = false;
        if (this.#summarize === summarize.document && this.#parts.length > 0) {
          this.#controller.enqueue(this.#parts.join(""));
          this.#parts = [];
        }
        break;
      case "comment":
        if (this.#comments) {
          this.#emit(`#${event.comment}${this.#lineBreak}`);
        }
        break;
      case "table":
        if (this.#stack.length > 0 || this.#pendingKey) {
          throw this.#makeError("Unexpected table header inside container or after key");
        }
        this.#emit(`[${formatKeyPath(event.path)}]${this.#lineBreak}`);
        break;
      case "arrayTable":
        if (this.#stack.length > 0 || this.#pendingKey) {
          throw this.#makeError("Unexpected arrayTable header inside container or after key");
        }
        this.#emit(`[[${formatKeyPath(event.path)}]]${this.#lineBreak}`);
        break;
      case "key": {
        if (this.#pendingKey) {
          throw this.#makeError("Unexpected key while previous key is awaiting value");
        }
        const top = this.#stack[this.#stack.length - 1];
        if (top?.type === "inlineTable") {
          if (top.count > 0) this.#emit(", ");
          top.count++;
        }
        else if (top?.type === "array") {
          throw this.#makeError("Unexpected key inside array");
        }
        this.#emit(`${formatKeyPath(event.path)} = `);
        this.#pendingKey = true;
        break;
      }
      case "startArray":
        this.#beforeValue();
        this.#stack.push({ type: "array", count: 0 });
        this.#emit("[");
        break;
      case "endArray": {
        const top = this.#stack.pop();
        if (top?.type !== "array") {
          throw this.#makeError("Unexpected endArray");
        }
        this.#emit("]");
        this.#emitLineEndIfTop();
        break;
      }
      case "startInlineTable":
        this.#beforeValue();
        this.#stack.push({ type: "inlineTable", count: 0 });
        this.#emit("{");
        break;
      case "endInlineTable": {
        const top = this.#stack.pop();
        if (top?.type !== "inlineTable") {
          throw this.#makeError("Unexpected endInlineTable");
        }
        this.#emit("}");
        this.#emitLineEndIfTop();
        break;
      }
      case "value":
        this.#beforeValue();
        this.#emit(formatValue(event));
        this.#emitLineEndIfTop();
        break;
    }
  }

  #flush(): void {
    if (this.#stack.length > 0 || this.#pendingKey) {
      throw this.#makeError("Unexpected end of stream with unclosed container or pending key");
    }
    if (this.#summarize === summarize.document && this.#parts.length > 0) {
      this.#controller.enqueue(this.#parts.join(""));
      this.#parts = [];
    }
  }
}
