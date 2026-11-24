import type { SACEventInterface } from "./event-interface/index.js";
import {
  ColumnEvent,
  EndDocumentEvent,
  EndHeaderRowEvent,
  EndRecordRowEvent,
  StartDocumentEvent,
  StartHeaderRowEvent,
  StartRecordRowEvent,
} from "./event/index.js";
import { toErrorMessage } from "./utils/index.js";

const skip = Symbol.for("ObjectToSACTransformStream.skip");

/**
 * Column input accepted by `ObjectToSACTransformStream` mappers and value formatters.
 */
export type ObjectToSACColumnInput = string | {
  value: string
  header?: string
  quoted?: boolean
};

/**
 * Context passed to the `mapRow` callback of `ObjectToSACTransformStream`.
 */
export type ObjectToSACRowContext = {
  /** Active header names, if configured or inferred. */
  headers: readonly string[] | undefined
  /** Zero-based index of the current record row. */
  rowIndex: number
  /** Return this symbol from `mapRow` to skip emitting the current row. */
  skip: typeof skip
};

/**
 * Callback that maps an input row object/value into an iterable of column inputs.
 */
export type ObjectToSACRowMapper<T> = (
  row: T,
  context: ObjectToSACRowContext,
) => Iterable<ObjectToSACColumnInput> | typeof skip;

/**
 * Context passed to the `formatValue` callback of `ObjectToSACTransformStream`.
 */
export type ObjectToSACValueContext = {
  index: number
  header: string | undefined
  rowIndex: number
};

/**
 * Callback that converts a cell value into a column input.
 */
export type ObjectToSACValueFormatter = (
  value: unknown,
  context: ObjectToSACValueContext,
) => ObjectToSACColumnInput;

/**
 * Configuration options for `ObjectToSACTransformStream`.
 */
export type ObjectToSACTransformStreamOptions<T> = {
  /** Wrap the emitted events in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /**
   * Header configuration:
   * - `readonly string[]`: explicit column order and header names
   * - `true`: infer headers from the first object row's own enumerable keys
   * - `false` (default): no headers
   */
  header?: boolean | readonly string[]
  /**
   * Whether to emit a `startHeaderRow`..`endHeaderRow` sequence when headers are available.
   * Defaults to `true` when `header` is `true` or an array, and `false` otherwise.
   */
  emitHeader?: boolean
  /** Custom mapper from a row chunk to an iterable of column inputs. */
  mapRow?: ObjectToSACRowMapper<T>
  /** Custom cell value formatter used by the default object/iterable mapping. */
  formatValue?: ObjectToSACValueFormatter
};

type Status = {
  get makeDocument(): boolean
  get headers(): string[] | undefined
  get rowIndex(): number
  get documentStarted(): boolean
  get headerEmitted(): boolean
};

/**
 * Error thrown by `ObjectToSACTransformStream` when an unsupported row value or mapper error is encountered.
 */
export class ObjectToSACTransformStreamError extends Error implements Status {
  makeDocument: boolean;
  headers: string[] | undefined;
  rowIndex: number;
  documentStarted: boolean;
  headerEmitted: boolean;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "ObjectToSACTransformStreamError";
    ({
      makeDocument: this.makeDocument,
      headers: this.headers,
      rowIndex: this.rowIndex,
      documentStarted: this.documentStarted,
      headerEmitted: this.headerEmitted,
    } = status);
  }
}

function defaultFormatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (typeof value === "symbol") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value) ?? "";
}

function isIterableObject(value: object): value is Iterable<unknown> {
  return Symbol.iterator in value && typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function";
}

/**
 * A `TransformStream` that converts JavaScript row objects or iterables into a stream of SAC events.
 */
export class ObjectToSACTransformStream<T = unknown> extends TransformStream<T, SACEventInterface> {
  static readonly skip = skip;

  #makeDocument: boolean;
  #headerOption: boolean | readonly string[];
  #emitHeader: boolean;
  #mapRow: ObjectToSACRowMapper<T> | undefined;
  #formatValue: ObjectToSACValueFormatter;
  #headers: string[] | undefined;
  #inferredKeys: string[] | undefined = undefined;
  #rowIndex = 0;
  #documentStarted = false;
  #headerEmitted = false;
  #controller!: TransformStreamDefaultController<SACEventInterface>;

  constructor(options?: ObjectToSACTransformStreamOptions<T>) {
    let controller_!: TransformStreamDefaultController<SACEventInterface>;
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
    this.#makeDocument = options?.makeDocument ?? true;
    this.#headerOption = options?.header ?? false;
    this.#headers = typeof this.#headerOption !== "boolean" ? [...this.#headerOption] : undefined;
    this.#emitHeader = options?.emitHeader ?? (this.#headerOption !== false);
    this.#mapRow = options?.mapRow;
    this.#formatValue = options?.formatValue ?? defaultFormatValue;
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      makeDocument: this.#makeDocument,
      headers: this.#headers ? [...this.#headers] : undefined,
      rowIndex: this.#rowIndex,
      documentStarted: this.#documentStarted,
      headerEmitted: this.#headerEmitted,
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): ObjectToSACTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new ObjectToSACTransformStreamError(message as string, this.#status(), options);
  }

  #ensureDocumentStarted(): void {
    if (!this.#documentStarted) {
      this.#documentStarted = true;
      if (this.#makeDocument) {
        this.#controller.enqueue(new StartDocumentEvent());
      }
    }
  }

  #ensureHeaderEmitted(): void {
    if (this.#emitHeader && !this.#headerEmitted && this.#headers !== undefined) {
      this.#ensureDocumentStarted();
      this.#headerEmitted = true;
      this.#controller.enqueue(new StartHeaderRowEvent());
      for (let i = 0; i < this.#headers.length; i++) {
        this.#controller.enqueue(new ColumnEvent(this.#headers[i], { index: i }));
      }
      this.#controller.enqueue(new EndHeaderRowEvent());
    }
  }

  #emitColumn(input: ObjectToSACColumnInput, index: number): void {
    if (typeof input === "string") {
      this.#controller.enqueue(new ColumnEvent(input, {
        index,
        header: this.#headers?.[index],
      }));
      return;
    }
    this.#controller.enqueue(new ColumnEvent(input.value, {
      index,
      header: input.header ?? this.#headers?.[index],
      quoted: input.quoted,
    }));
  }

  #emitRecordColumns(columns: Iterable<ObjectToSACColumnInput>): void {
    this.#ensureDocumentStarted();
    this.#ensureHeaderEmitted();
    this.#controller.enqueue(new StartRecordRowEvent());
    let index = 0;
    for (const col of columns) {
      this.#emitColumn(col, index);
      index++;
    }
    this.#controller.enqueue(new EndRecordRowEvent());
    this.#rowIndex++;
  }

  #transform(chunk: T): void {
    try {
      if (this.#mapRow) {
        let mapped: Iterable<ObjectToSACColumnInput> | typeof skip;
        try {
          mapped = this.#mapRow(chunk, {
            headers: this.#headers ? [...this.#headers] : undefined,
            rowIndex: this.#rowIndex,
            skip,
          });
        }
        catch (e: unknown) {
          throw this.#makeError(e);
        }
        if (mapped === skip) return;
        this.#emitRecordColumns(mapped);
        return;
      }

      if (chunk === null || typeof chunk !== "object") {
        throw this.#makeError(`Unsupported row value: ${String(chunk)}`);
      }

      if (isIterableObject(chunk)) {
        const columns: ObjectToSACColumnInput[] = [];
        let index = 0;
        for (const value of chunk) {
          columns.push(this.#formatValue(value, {
            index,
            header: this.#headers?.[index],
            rowIndex: this.#rowIndex,
          }));
          index++;
        }
        this.#emitRecordColumns(columns);
        return;
      }

      const record = chunk as Record<string, unknown>;
      let keys: readonly string[];
      if (this.#headers !== undefined) {
        keys = this.#headers;
      }
      else if (this.#headerOption === true) {
        this.#headers = Object.keys(record);
        keys = this.#headers;
      }
      else {
        this.#inferredKeys ??= Object.keys(record);
        keys = this.#inferredKeys;
      }

      const columns: ObjectToSACColumnInput[] = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        columns.push(this.#formatValue(record[key], {
          index: i,
          header: this.#headers?.[i],
          rowIndex: this.#rowIndex,
        }));
      }
      this.#emitRecordColumns(columns);
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }

  #flush(): void {
    if (this.#emitHeader && !this.#headerEmitted && this.#headers !== undefined) {
      this.#ensureHeaderEmitted();
    }
    if (this.#documentStarted && this.#makeDocument) {
      this.#controller.enqueue(new EndDocumentEvent());
    }
  }
}
