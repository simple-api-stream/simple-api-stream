import type { SAYEventInterface } from "./event-interface/index.js";
import {
  AliasEvent,
  EndDocumentEvent,
  EndMappingEvent,
  EndSequenceEvent,
  KeyEvent,
  ScalarEvent,
  StartDocumentEvent,
  StartMappingEvent,
  StartSequenceEvent,
} from "./event/index.js";
import { toErrorMessage } from "./utils/index.js";

const unSupporteds = Object.freeze({
  ignore: "ignore",
  error: "error",
  null: "null",
} as const);
type UnSupporteds = typeof unSupporteds[keyof typeof unSupporteds];

const skip = Symbol.for("ObjectToSAYTransformStream.skip");

/**
 * Callback invoked when `ObjectToSAYTransformStream` encounters a value that cannot be represented in YAML.
 */
export type ObjectToSAYUnsupportedHandler = (arg: { value: unknown, skip: typeof skip }) => unknown;

/**
 * Configuration options for `ObjectToSAYTransformStream`.
 */
export type ObjectToSAYTransformStreamOptions = {
  /** Wrap each written value in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /**
   * Automatically emit YAML anchors (`&a1`, ...) and aliases (`*a1`, ...) for shared and circular object/array references (default: `false`).
   */
  anchors?: boolean
  /**
   * How to handle values that cannot be represented in YAML (`undefined`, functions, symbols, `bigint`, invalid `Date`).
   * - `"ignore"` (default): omit the key/element
   * - `"error"`: error the stream
   * - `"null"`: replace with `null`
   * - function: return a replacement value, or return `skip` to omit
   */
  unSupported?: UnSupporteds | ObjectToSAYUnsupportedHandler
};

type Status = {
  get makeDocument(): boolean
  get anchors(): boolean
  get unSupported(): ReturnType<typeof toUnsupported>
};

/**
 * Error thrown by `ObjectToSAYTransformStream` when an unsupported value or circular reference is encountered.
 */
export class ObjectToSAYTransformStreamError extends Error implements Status {
  makeDocument: boolean;
  anchors: boolean;
  unSupported: ReturnType<typeof toUnsupported>;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "ObjectToSAYTransformStreamError";
    ({
      makeDocument: this.makeDocument,
      anchors: this.anchors,
      unSupported: this.unSupported,
    } = status);
  }
}

function unSupportedToError({ value }: Parameters<ObjectToSAYUnsupportedHandler>[0]): never {
  const error = new Error(`Unsupported YAML value: ${String(value)}`);
  error.name = "UnSupportedValueError";
  (error as unknown as Record<string, unknown>).value = value;
  throw error;
}

function unSupportedToNull(): null {
  return null;
}

function toUnsupported(unSupported: ObjectToSAYUnsupportedHandler | typeof skip) {
  if (unSupported === skip) return [unSupporteds.ignore, unSupported] as const;
  if (unSupported === unSupportedToError) return [unSupporteds.error, unSupported] as const;
  if (unSupported === unSupportedToNull) return [unSupporteds.null, unSupported] as const;
  return ["custom", unSupported] as const;
}

/**
 * A `TransformStream` that converts JavaScript values into a stream of SAY (Simple API for YAML) events.
 */
export class ObjectToSAYTransformStream<T = unknown> extends TransformStream<T, SAYEventInterface> {
  static readonly skip = skip;
  static readonly unSupportedToError = unSupportedToError;
  static readonly unSupportedToNull = unSupportedToNull;

  #makeDocument: boolean;
  #anchors: boolean;
  #unSupported: ObjectToSAYUnsupportedHandler | typeof skip;
  #controller!: TransformStreamDefaultController<SAYEventInterface>;

  constructor(options?: ObjectToSAYTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<SAYEventInterface>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#transform(chunk);
      },
    });
    this.#makeDocument = options?.makeDocument ?? true;
    this.#anchors = options?.anchors ?? false;
    this.#unSupported = this.#toUnsupported(options?.unSupported);
    this.#controller = controller_;
  }

  #toUnsupported(unSupported?: UnSupporteds | ObjectToSAYUnsupportedHandler): ObjectToSAYUnsupportedHandler | typeof skip {
    unSupported ??= unSupporteds.ignore;
    if (unSupported === unSupporteds.ignore) return skip;
    if (unSupported === unSupporteds.error) return unSupportedToError;
    if (unSupported === unSupporteds.null) return unSupportedToNull;
    return unSupported;
  }

  #status(): Status {
    return {
      makeDocument: this.#makeDocument,
      anchors: this.#anchors,
      unSupported: toUnsupported(this.#unSupported),
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): ObjectToSAYTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new ObjectToSAYTransformStreamError(message as string, this.#status(), options);
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

  #collectSharedAnchors(root: unknown): Map<object, string> {
    const seen = new Set<object>();
    const shared = new Map<object, string>();
    let seq = 0;

    const visit = (value: unknown): void => {
      if (typeof value !== "object" || value === null || value instanceof Date) return;
      if (seen.has(value)) {
        if (!shared.has(value)) {
          shared.set(value, `a${++seq}`);
        }
        return;
      }
      seen.add(value);
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      }
      else {
        for (const v of Object.values(value)) visit(v);
      }
    };

    visit(root);
    return shared;
  }

  * #emitValue(
    value: unknown,
    allowUnsupported: boolean,
    ancestors: Set<object>,
    sharedAnchors: Map<object, string>,
    emittedAnchors: Set<object>,
  ): Generator<SAYEventInterface, boolean, void> {
    if (value === null) {
      yield new ScalarEvent("null", null).toInterface();
      return true;
    }
    if (typeof value === "boolean") {
      yield new ScalarEvent("boolean", value).toInterface();
      return true;
    }
    if (typeof value === "number") {
      yield new ScalarEvent("number", value).toInterface();
      return true;
    }
    if (typeof value === "string") {
      yield new ScalarEvent("string", value).toInterface();
      return true;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        const resolved = this.#resolveUnsupported(value, allowUnsupported);
        if (resolved.skipped) return false;
        return yield* this.#emitValue(resolved.value, false, ancestors, sharedAnchors, emittedAnchors);
      }
      yield new ScalarEvent("string", value.toISOString()).toInterface();
      return true;
    }
    if (typeof value !== "object") {
      const resolved = this.#resolveUnsupported(value, allowUnsupported);
      if (resolved.skipped) return false;
      return yield* this.#emitValue(resolved.value, false, ancestors, sharedAnchors, emittedAnchors);
    }

    const anchor = sharedAnchors.get(value);
    if (anchor !== undefined) {
      if (emittedAnchors.has(value)) {
        yield new AliasEvent(anchor);
        return true;
      }
      emittedAnchors.add(value);
    }
    else if (ancestors.has(value)) {
      throw this.#makeError("Circular reference detected");
    }

    ancestors.add(value);
    try {
      const meta = anchor !== undefined ? { anchor } : undefined;
      if (Array.isArray(value)) {
        yield new StartSequenceEvent(meta);
        for (const item of value) {
          yield* this.#emitValue(item, true, ancestors, sharedAnchors, emittedAnchors);
        }
        yield new EndSequenceEvent();
        return true;
      }

      yield new StartMappingEvent(meta);
      for (const [k, v] of Object.entries(value)) {
        const events: SAYEventInterface[] = [];
        const emitted = this.#collectValue(v, ancestors, sharedAnchors, emittedAnchors, events);
        if (emitted) {
          yield new KeyEvent(k);
          yield* events;
        }
      }
      yield new EndMappingEvent();
      return true;
    }
    finally {
      ancestors.delete(value);
    }
  }

  #collectValue(
    value: unknown,
    ancestors: Set<object>,
    sharedAnchors: Map<object, string>,
    emittedAnchors: Set<object>,
    out: SAYEventInterface[],
  ): boolean {
    const gen = this.#emitValue(value, true, ancestors, sharedAnchors, emittedAnchors);
    while (true) {
      const next = gen.next();
      if (next.done) return next.value;
      out.push(next.value);
    }
  }

  #transform(chunk: T): void {
    try {
      const ancestors = new Set<object>();
      const sharedAnchors = this.#anchors ? this.#collectSharedAnchors(chunk) : new Map<object, string>();
      const emittedAnchors = new Set<object>();
      const events: SAYEventInterface[] = [];
      const emitted = this.#collectValue(chunk, ancestors, sharedAnchors, emittedAnchors, events);
      if (!emitted) return;
      if (this.#makeDocument) {
        this.#controller.enqueue(new StartDocumentEvent());
      }
      for (const event of events) {
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
