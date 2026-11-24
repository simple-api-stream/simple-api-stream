import type { ColumnSACEventInterface, SACEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

const skip = Symbol.for("SACToObjectTransformStream.skip");

/**
 * Context passed to the `mapRow` callback of `SACToObjectTransformStream`.
 */
export type SACToObjectRowContext = {
  /** Column events collected for the current record row. */
  columns: readonly ColumnSACEventInterface[]
  /** Header names collected from the header row, if any. */
  headers: readonly string[] | undefined
  /** Zero-based index of the current record row within the document. */
  rowIndex: number
  /** Return this symbol from `mapRow` to skip emitting the current row. */
  skip: typeof skip
};

/**
 * Callback that maps a CSV record row's column events and metadata into a JavaScript value.
 */
export type SACToObjectRowMapper<T> = (context: SACToObjectRowContext) => T | typeof skip;

/**
 * Configuration options for `SACToObjectTransformStream`.
 */
export type SACToObjectTransformStreamOptions<T> = {
  /** Custom row mapper. Defaults to `SACToObjectTransformStream.toObject`. */
  mapRow?: SACToObjectRowMapper<T>
};

type Status = {
  get inDocument(): boolean
  get inRow(): "header" | "record" | null
  get headers(): string[] | undefined
  get rowIndex(): number
};

/**
 * Error thrown by `SACToObjectTransformStream` when an invalid SAC event sequence or mapper error is encountered.
 */
export class SACToObjectTransformStreamError extends Error implements Status {
  inDocument: boolean;
  inRow: "header" | "record" | null;
  headers: string[] | undefined;
  rowIndex: number;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SACToObjectTransformStreamError";
    ({
      inDocument: this.inDocument,
      inRow: this.inRow,
      headers: this.headers,
      rowIndex: this.rowIndex,
    } = status);
  }
}

function rowToObject({ columns, headers }: SACToObjectRowContext): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const key = col.header ?? headers?.[i] ?? String(col.index ?? i);
    Reflect.defineProperty(obj, key, {
      value: col.value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return obj;
}

function rowToArray({ columns }: SACToObjectRowContext): string[] {
  return columns.map(col => col.value);
}

/**
 * A `TransformStream` that reconstructs JavaScript objects (or custom row values) from a stream of SAC events.
 */
export class SACToObjectTransformStream<T = Record<string, string>> extends TransformStream<SACEventInterface, T> {
  static readonly skip = skip;
  static readonly toObject: SACToObjectRowMapper<Record<string, string>> = rowToObject;
  static readonly toArray: SACToObjectRowMapper<string[]> = rowToArray;

  #mapRow: SACToObjectRowMapper<T>;
  #inDocument = false;
  #inRow: "header" | "record" | null = null;
  #headers: string[] | undefined = undefined;
  #columns: ColumnSACEventInterface[] = [];
  #rowIndex = 0;
  #controller!: TransformStreamDefaultController<T>;

  constructor(options?: SACToObjectTransformStreamOptions<T>) {
    let controller_!: TransformStreamDefaultController<T>;
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
    this.#mapRow = (options?.mapRow ?? rowToObject) as SACToObjectRowMapper<T>;
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      inDocument: this.#inDocument,
      inRow: this.#inRow,
      headers: this.#headers ? [...this.#headers] : undefined,
      rowIndex: this.#rowIndex,
    };
  }

  /**
   * Returns the current reconstructor status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SACToObjectTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SACToObjectTransformStreamError(message as string, this.#status(), options);
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
          this.#columns = [];
          this.#rowIndex = 0;
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
          break;
        }
        case "startHeaderRow": {
          if (this.#inRow !== null) {
            throw this.#makeError(`Unexpected startHeaderRow while ${this.#inRow} row is still open`);
          }
          this.#inRow = "header";
          this.#columns = [];
          break;
        }
        case "endHeaderRow": {
          if (this.#inRow !== "header") {
            throw this.#makeError("Unexpected endHeaderRow without matching startHeaderRow");
          }
          this.#headers = this.#columns.map(col => col.value);
          this.#columns = [];
          this.#inRow = null;
          break;
        }
        case "startRecordRow": {
          if (this.#inRow !== null) {
            throw this.#makeError(`Unexpected startRecordRow while ${this.#inRow} row is still open`);
          }
          this.#inRow = "record";
          this.#columns = [];
          break;
        }
        case "endRecordRow": {
          if (this.#inRow !== "record") {
            throw this.#makeError("Unexpected endRecordRow without matching startRecordRow");
          }
          const columns = this.#columns;
          const rowIndex = this.#rowIndex;
          this.#columns = [];
          this.#inRow = null;
          this.#rowIndex++;

          let result: T | typeof skip;
          try {
            result = this.#mapRow({
              columns,
              headers: this.#headers ? [...this.#headers] : undefined,
              rowIndex,
              skip,
            });
          }
          catch (e: unknown) {
            throw this.#makeError(e);
          }

          if (result !== skip) {
            this.#controller.enqueue(result);
          }
          break;
        }
        case "column": {
          if (this.#inRow === null) {
            throw this.#makeError("Unexpected column outside of a row");
          }
          this.#columns.push(event);
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
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }
}
