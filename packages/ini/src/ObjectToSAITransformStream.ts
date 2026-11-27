import type { SAIEventInterface } from "./event-interface/index.js";
import {
  EndDocumentEvent,
  EntryEvent,
  SectionEvent,
  StartDocumentEvent,
} from "./event/index.js";
import { toErrorMessage } from "./utils/index.js";

const unSupporteds = Object.freeze({
  ignore: "ignore",
  error: "error",
} as const);
type UnSupporteds = typeof unSupporteds[keyof typeof unSupporteds];

const skip = Symbol.for("ObjectToSAITransformStream.skip");

/**
 * Callback invoked when `ObjectToSAITransformStream` encounters a value that cannot be represented in INI.
 */
export type ObjectToSAIUnsupportedHandler = (arg: { value: unknown, skip: typeof skip }) => unknown;

/**
 * Configuration options for `ObjectToSAITransformStream`.
 */
export type ObjectToSAITransformStreamOptions = {
  /** Wrap each emitted document in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /**
   * Flatten nested plain objects into dot-separated section names (e.g. `[a.b]`).
   * When `false`, objects nested inside a section are passed to `unSupported`.
   * (default: `true`)
   */
  flattenSections?: boolean
  /**
   * How to handle values that cannot be represented in INI (`null`, `undefined`, arrays, functions, symbols, `bigint`, nested objects when `flattenSections` is `false`).
   * - `"ignore"` (default): omit the key
   * - `"error"`: error the stream
   * - function: return a replacement value (e.g. a `string`), or return `skip` to omit
   */
  unSupported?: UnSupporteds | ObjectToSAIUnsupportedHandler
};

type Status = {
  get makeDocument(): boolean
  get flattenSections(): boolean
  get unSupported(): ReturnType<typeof toUnsupported>
};

/**
 * Error thrown by `ObjectToSAITransformStream` when an unsupported value, non-object root, or circular reference is encountered.
 */
export class ObjectToSAITransformStreamError extends Error implements Status {
  makeDocument: boolean;
  flattenSections: boolean;
  unSupported: ReturnType<typeof toUnsupported>;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "ObjectToSAITransformStreamError";
    ({
      makeDocument: this.makeDocument,
      flattenSections: this.flattenSections,
      unSupported: this.unSupported,
    } = status);
  }
}

function unSupportedToError({ value }: Parameters<ObjectToSAIUnsupportedHandler>[0]): never {
  const error = new Error(`Unsupported INI value: ${String(value)}`);
  error.name = "UnSupportedValueError";
  (error as unknown as Record<string, unknown>).value = value;
  throw error;
}

function toUnsupported(unSupported: ObjectToSAIUnsupportedHandler | typeof skip) {
  if (unSupported === skip) return [unSupporteds.ignore, unSupported] as const;
  if (unSupported === unSupportedToError) return [unSupporteds.error, unSupported] as const;
  return ["custom", unSupported] as const;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * A `TransformStream` that converts JavaScript objects into a stream of SAI (Simple API for INI) events.
 */
export class ObjectToSAITransformStream<T = unknown> extends TransformStream<T, SAIEventInterface> {
  static readonly skip = skip;
  static readonly unSupportedToError = unSupportedToError;

  #makeDocument: boolean;
  #flattenSections: boolean;
  #unSupported: ObjectToSAIUnsupportedHandler | typeof skip;
  #controller!: TransformStreamDefaultController<SAIEventInterface>;

  constructor(options?: ObjectToSAITransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<SAIEventInterface>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#transform(chunk);
      },
    });
    this.#makeDocument = options?.makeDocument ?? true;
    this.#flattenSections = options?.flattenSections ?? true;
    this.#unSupported = this.#toUnsupported(options?.unSupported);
    this.#controller = controller_;
  }

  #toUnsupported(unSupported?: UnSupporteds | ObjectToSAIUnsupportedHandler): ObjectToSAIUnsupportedHandler | typeof skip {
    unSupported ??= unSupporteds.ignore;
    if (unSupported === unSupporteds.ignore) return skip;
    if (unSupported === unSupporteds.error) return unSupportedToError;
    return unSupported;
  }

  #status(): Status {
    return {
      makeDocument: this.#makeDocument,
      flattenSections: this.#flattenSections,
      unSupported: toUnsupported(this.#unSupported),
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): ObjectToSAITransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new ObjectToSAITransformStreamError(message as string, this.#status(), options);
  }

  #resolveScalar(value: unknown, allowUnsupported: boolean): { skipped: true } | { skipped: false, value: string } {
    if (typeof value === "string") {
      return { skipped: false, value };
    }
    if (typeof value === "boolean") {
      return { skipped: false, value: value ? "true" : "false" };
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return { skipped: false, value: String(value) };
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return { skipped: false, value: value.toISOString() };
    }
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
    return this.#resolveScalar(replaced, false);
  }

  * #emitTableBody(
    table: Record<string, unknown>,
    path: string[],
    ancestors: Set<object>,
  ): Generator<SAIEventInterface, void, void> {
    if (ancestors.has(table)) {
      throw this.#makeError("Circular reference detected");
    }
    ancestors.add(table);
    try {
      const subSections: [string, Record<string, unknown>][] = [];

      for (const [k, v] of Object.entries(table)) {
        if (isPlainObject(v) && (path.length === 0 || this.#flattenSections)) {
          subSections.push([k, v]);
        }
        else {
          const resolved = this.#resolveScalar(v, true);
          if (!resolved.skipped) {
            yield new EntryEvent(k, resolved.value);
          }
        }
      }

      for (const [k, sub] of subSections) {
        const subPath = [...path, k];
        yield new SectionEvent(subPath.join("."));
        yield* this.#emitTableBody(sub, subPath, ancestors);
      }
    }
    finally {
      ancestors.delete(table);
    }
  }

  #transform(chunk: T): void {
    try {
      if (!isPlainObject(chunk)) {
        throw this.#makeError("INI root value must be a plain object");
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
