import type { eventInterfaces } from "@simple-api-stream/json";
import type { SACEventInterface } from "../event-interface/index.js";
import { toErrorMessage } from "../utils/index.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

/**
 * Row representation mode for `SACToSAJTransformStream`.
 */
export type SACToSAJRowFormat = "auto" | "object" | "array";

/**
 * Configuration options for `SACToSAJTransformStream`.
 */
export type SACToSAJTransformStreamOptions = {
  /**
   * How each record row is serialized as JSON:
   * - `"auto"` (default): JSON object when headers are present, JSON array otherwise
   * - `"object"`: always JSON object (falls back to stringified column index when header is absent)
   * - `"array"`: always JSON array of column values
   */
  rowFormat?: SACToSAJRowFormat
  /**
   * When `false` (default), wraps all rows in a single top-level JSON array `[row1, row2, ...]`.
   * When `true`, emits each record row as its own top-level JSON value/document (suitable for NDJSON / JSON Lines).
   */
  multiple?: boolean
  /** Wrap each emitted JSON document in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /** When `rowFormat` is `"array"` and `true`, also emits the header row as the first array row (default: `false`). */
  includeHeaderRow?: boolean
};

type Status = {
  get inDocument(): boolean
  get inRow(): "header" | "record" | null
  get headers(): string[] | undefined
};

/**
 * Error thrown by `SACToSAJTransformStream` when an invalid SAC event sequence is encountered.
 */
export class SACToSAJTransformStreamError extends Error implements Status {
  inDocument: boolean;
  inRow: "header" | "record" | null;
  headers: string[] | undefined;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SACToSAJTransformStreamError";
    ({
      inDocument: this.inDocument,
      inRow: this.inRow,
      headers: this.headers,
    } = status);
  }
}

/**
 * A `TransformStream` that streams SAC (Simple API for CSV) events directly into SAJ (Simple API for JSON) events
 * in O(1) memory per row.
 */
export class SACToSAJTransformStream extends TransformStream<SACEventInterface, SAJEventInterface> {
  #rowFormat: SACToSAJRowFormat;
  #multiple: boolean;
  #makeDocument: boolean;
  #includeHeaderRow: boolean;
  #inDocument = false;
  #arrayOpened = false;
  #inRow: "header" | "record" | null = null;
  #headers: string[] | undefined = undefined;
  #headerValues: string[] = [];
  #rowStarted = false;
  #rowIsObject = false;
  #colIndex = 0;
  #controller!: TransformStreamDefaultController<SAJEventInterface>;

  constructor(options?: SACToSAJTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<SAJEventInterface>;
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
    this.#rowFormat = options?.rowFormat ?? "auto";
    this.#multiple = options?.multiple ?? false;
    this.#makeDocument = options?.makeDocument ?? true;
    this.#includeHeaderRow = options?.includeHeaderRow ?? false;
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      inDocument: this.#inDocument,
      inRow: this.#inRow,
      headers: this.#headers ? [...this.#headers] : undefined,
    };
  }

  /**
   * Returns the current converter status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SACToSAJTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SACToSAJTransformStreamError(message as string, this.#status(), options);
  }

  #emit(event: SAJEventInterface): void {
    this.#controller.enqueue(event);
  }

  #ensureArrayOpened(): void {
    if (this.#multiple || this.#arrayOpened) return;
    this.#arrayOpened = true;
    if (this.#makeDocument) {
      this.#emit({ name: "startDocument", kind: "json" });
    }
    this.#emit({ name: "startArray" });
  }

  #closeArray(): void {
    if (!this.#arrayOpened) return;
    this.#emit({ name: "endArray" });
    if (this.#makeDocument) {
      this.#emit({ name: "endDocument" });
    }
    this.#arrayOpened = false;
  }

  #startRowContainer(isObject: boolean): void {
    this.#rowStarted = true;
    this.#rowIsObject = isObject;
    if (this.#multiple) {
      if (this.#makeDocument) {
        this.#emit({ name: "startDocument", kind: "json" });
      }
    }
    else {
      this.#ensureArrayOpened();
    }
    this.#emit(isObject ? { name: "startObject" } : { name: "startArray" });
  }

  #endRowContainer(): void {
    this.#emit(this.#rowIsObject ? { name: "endObject" } : { name: "endArray" });
    if (this.#multiple && this.#makeDocument) {
      this.#emit({ name: "endDocument" });
    }
    this.#rowStarted = false;
  }

  #transform(event: SACEventInterface): void {
    try {
      switch (event.name) {
        case "startDocument": {
          if (this.#inDocument) {
            throw this.#makeError("Unexpected startDocument inside an open document");
          }
          if (this.#inRow !== null) {
            throw this.#makeError("Unexpected startDocument inside an open row");
          }
          this.#inDocument = true;
          this.#headers = undefined;
          if (!this.#multiple) {
            this.#ensureArrayOpened();
          }
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
          this.#closeArray();
          break;
        }
        case "startHeaderRow": {
          if (this.#inRow !== null) {
            throw this.#makeError(`Unexpected startHeaderRow while ${this.#inRow} row is still open`);
          }
          this.#inRow = "header";
          this.#headerValues = [];
          break;
        }
        case "endHeaderRow": {
          if (this.#inRow !== "header") {
            throw this.#makeError("Unexpected endHeaderRow without matching startHeaderRow");
          }
          this.#headers = this.#headerValues;
          this.#headerValues = [];
          this.#inRow = null;
          if (this.#rowFormat === "array" && this.#includeHeaderRow) {
            this.#startRowContainer(false);
            for (const header of this.#headers) {
              this.#emit({ name: "value", type: "string", value: header });
            }
            this.#endRowContainer();
          }
          break;
        }
        case "startRecordRow": {
          if (this.#inRow !== null) {
            throw this.#makeError(`Unexpected startRecordRow while ${this.#inRow} row is still open`);
          }
          this.#inRow = "record";
          this.#colIndex = 0;
          this.#rowStarted = false;
          break;
        }
        case "endRecordRow": {
          if (this.#inRow !== "record") {
            throw this.#makeError("Unexpected endRecordRow without matching startRecordRow");
          }
          if (!this.#rowStarted) {
            const isObject = this.#rowFormat === "object"
              || (this.#rowFormat === "auto" && this.#headers !== undefined);
            this.#startRowContainer(isObject);
          }
          this.#endRowContainer();
          this.#inRow = null;
          break;
        }
        case "column": {
          if (this.#inRow === null) {
            throw this.#makeError("Unexpected column outside of a row");
          }
          if (this.#inRow === "header") {
            this.#headerValues.push(event.value);
            break;
          }
          if (!this.#rowStarted) {
            const isObject = this.#rowFormat === "object"
              || (this.#rowFormat === "auto" && (this.#headers !== undefined || event.header !== undefined));
            this.#startRowContainer(isObject);
          }
          if (this.#rowIsObject) {
            const key = event.header ?? this.#headers?.[this.#colIndex] ?? String(event.index ?? this.#colIndex);
            this.#emit({ name: "key", key });
          }
          this.#emit({ name: "value", type: "string", value: event.value });
          this.#colIndex++;
          break;
        }
        default: {
          const exhaustive: never = event;
          throw this.#makeError(`Unknown SAC event: ${String((exhaustive as { name?: unknown }).name)}`);
        }
      }
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }

  #flush(): void {
    try {
      if (this.#inRow !== null) {
        throw this.#makeError(`Stream ended with unclosed ${this.#inRow} row`);
      }
      if (this.#inDocument) {
        throw this.#makeError("Stream ended with unclosed document");
      }
      this.#closeArray();
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }
}
