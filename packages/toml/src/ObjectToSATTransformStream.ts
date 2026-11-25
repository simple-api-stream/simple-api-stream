import type { SATEventInterface } from "./event-interface/index.js";
import {
  ArrayTableEvent,
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
import { toErrorMessage } from "./utils/index.js";

const unSupporteds = Object.freeze({
  ignore: "ignore",
  error: "error",
} as const);
type UnSupporteds = typeof unSupporteds[keyof typeof unSupporteds];

const skip = Symbol.for("ObjectToSATTransformStream.skip");

/**
 * Callback invoked when `ObjectToSATTransformStream` encounters a value that cannot be represented in TOML.
 */
export type ObjectToSATUnsupportedHandler = (arg: { value: unknown, skip: typeof skip }) => unknown;

/**
 * Configuration options for `ObjectToSATTransformStream`.
 */
export type ObjectToSATTransformStreamOptions = {
  /** Wrap each emitted document in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /**
   * How to handle values that cannot be represented in TOML (`null`, `undefined`, `function`, `symbol`, `bigint`, invalid `Date`).
   * - `"ignore"` (default): omit the key/element
   * - `"error"`: error the stream
   * - function: return a replacement value, or return `skip` to omit
   */
  unSupported?: UnSupporteds | ObjectToSATUnsupportedHandler
};

type Status = {
  get makeDocument(): boolean
  get unSupported(): ReturnType<typeof toUnsupported>
};

/**
 * Error thrown by `ObjectToSATTransformStream` when an unsupported value, non-table root, or circular reference is encountered.
 */
export class ObjectToSATTransformStreamError extends Error implements Status {
  makeDocument: boolean;
  unSupported: ReturnType<typeof toUnsupported>;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "ObjectToSATTransformStreamError";
    ({
      makeDocument: this.makeDocument,
      unSupported: this.unSupported,
    } = status);
  }
}

function unSupportedToError({ value }: Parameters<ObjectToSATUnsupportedHandler>[0]): never {
  const error = new Error(`Unsupported TOML value: ${String(value)}`);
  error.name = "UnSupportedValueError";
  (error as unknown as Record<string, unknown>).value = value;
  throw error;
}

function toUnsupported(unSupported: ObjectToSATUnsupportedHandler | typeof skip) {
  if (unSupported === skip) return [unSupporteds.ignore, unSupported] as const;
  if (unSupported === unSupportedToError) return [unSupporteds.error, unSupported] as const;
  return ["custom", unSupported] as const;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function isArrayOfTables(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}

/**
 * A `TransformStream` that converts JavaScript table objects into a stream of SAT (Simple API for TOML) events.
 */
export class ObjectToSATTransformStream<T = unknown> extends TransformStream<T, SATEventInterface> {
  static readonly skip = skip;
  static readonly unSupportedToError = unSupportedToError;

  #makeDocument: boolean;
  #unSupported: ObjectToSATUnsupportedHandler | typeof skip;
  #controller!: TransformStreamDefaultController<SATEventInterface>;

  constructor(options?: ObjectToSATTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<SATEventInterface>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#transform(chunk);
      },
    });
    this.#makeDocument = options?.makeDocument ?? true;
    this.#unSupported = this.#toUnsupported(options?.unSupported);
    this.#controller = controller_;
  }

  #toUnsupported(unSupported?: UnSupporteds | ObjectToSATUnsupportedHandler): ObjectToSATUnsupportedHandler | typeof skip {
    unSupported ??= unSupporteds.ignore;
    if (unSupported === unSupporteds.ignore) return skip;
    if (unSupported === unSupporteds.error) return unSupportedToError;
    return unSupported;
  }

  #status(): Status {
    return {
      makeDocument: this.#makeDocument,
      unSupported: toUnsupported(this.#unSupported),
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): ObjectToSATTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new ObjectToSATTransformStreamError(message as string, this.#status(), options);
  }

  #resolveUnsupported(value: unknown, allowUnsupported: boolean): { skipped: true } | { skipped: false, value: unknown } {
    if (!allowUnsupported) {
      throw this.#makeError(`unSupported handler returned unsupported value: ${String(value)}`);
    }
    if (this.#unSupported === skip) {
      return { skipped: true };
    }
    let replaced: unknown;
    try {
      replaced = this.#unSupported({ value, skip });
    }
    catch (e: unknown) {
      throw this.#makeError(e);
    }
    if (replaced === skip) {
      return { skipped: true };
    }
    return { skipped: false, value: replaced };
  }

  * #emitInlineValue(
    value: unknown,
    allowUnsupported: boolean,
    ancestors: Set<object>,
  ): Generator<SATEventInterface, boolean, void> {
    if (typeof value === "string") {
      yield new ValueEvent("string", value);
      return true;
    }
    if (typeof value === "boolean") {
      yield new ValueEvent("boolean", value);
      return true;
    }
    if (typeof value === "number") {
      if (Number.isSafeInteger(value) && !Object.is(value, -0)) {
        yield new ValueEvent("integer", value);
      }
      else {
        yield new ValueEvent("float", value);
      }
      return true;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        const resolved = this.#resolveUnsupported(value, allowUnsupported);
        if (resolved.skipped) return false;
        return yield* this.#emitInlineValue(resolved.value, false, ancestors);
      }
      yield new ValueEvent("offsetDateTime", value.toISOString());
      return true;
    }
    if (typeof value !== "object" || value === null) {
      const resolved = this.#resolveUnsupported(value, allowUnsupported);
      if (resolved.skipped) return false;
      return yield* this.#emitInlineValue(resolved.value, false, ancestors);
    }

    if (ancestors.has(value)) {
      throw this.#makeError("Circular reference detected");
    }
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        yield new StartArrayEvent();
        for (const item of value) {
          yield* this.#emitInlineValue(item, true, ancestors);
        }
        yield new EndArrayEvent();
        return true;
      }

      yield new StartInlineTableEvent();
      for (const [k, v] of Object.entries(value)) {
        const events: SATEventInterface[] = [];
        const emitted = this.#collectInlineValue(v, ancestors, events);
        if (emitted) {
          yield new KeyEvent([k]);
          yield* events;
        }
      }
      yield new EndInlineTableEvent();
      return true;
    }
    finally {
      ancestors.delete(value);
    }
  }

  #collectInlineValue(value: unknown, ancestors: Set<object>, out: SATEventInterface[]): boolean {
    const gen = this.#emitInlineValue(value, true, ancestors);
    while (true) {
      const next = gen.next();
      if (next.done) return next.value;
      out.push(next.value);
    }
  }

  * #emitTableBody(
    table: Record<string, unknown>,
    path: string[],
    ancestors: Set<object>,
  ): Generator<SATEventInterface, void, void> {
    if (ancestors.has(table)) {
      throw this.#makeError("Circular reference detected");
    }
    ancestors.add(table);
    try {
      const subTables: [string, Record<string, unknown>][] = [];
      const arrayTables: [string, Record<string, unknown>[]][] = [];

      for (const [k, v] of Object.entries(table)) {
        if (isPlainObject(v)) {
          subTables.push([k, v]);
        }
        else if (isArrayOfTables(v)) {
          arrayTables.push([k, v]);
        }
        else {
          const events: SATEventInterface[] = [];
          const emitted = this.#collectInlineValue(v, ancestors, events);
          if (emitted) {
            yield new KeyEvent([k]);
            yield* events;
          }
        }
      }

      for (const [k, sub] of subTables) {
        const subPath = [...path, k];
        yield new TableEvent(subPath);
        yield* this.#emitTableBody(sub, subPath, ancestors);
      }

      for (const [k, items] of arrayTables) {
        const arrPath = [...path, k];
        for (const item of items) {
          yield new ArrayTableEvent(arrPath);
          yield* this.#emitTableBody(item, arrPath, ancestors);
        }
      }
    }
    finally {
      ancestors.delete(table);
    }
  }

  #transform(chunk: T): void {
    try {
      if (!isPlainObject(chunk)) {
        throw this.#makeError("TOML root value must be a plain object");
      }
      const ancestors = new Set<object>();
      if (this.#makeDocument) {
        this.#controller.enqueue(new StartDocumentEvent());
      }
      for (const event of this.#emitTableBody(chunk, [], ancestors)) {
        this.#controller.enqueue(event);
      }
      if (this.#makeDocument) {
        this.#controller.enqueue(new EndDocumentEvent());
      }
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }
}
