import type { eventInterfaces } from "@simple-api-stream/toml";
import {
  CommentEvent,
  EndDocumentEvent,
  EntryEvent,
  SectionEvent,
  StartDocumentEvent,
} from "../event/index.js";
import type { SAIEventInterface } from "../event-interface/index.js";
import { toErrorMessage } from "../utils/index.js";

type SATEventInterface = eventInterfaces.SATEventInterface;
type UnsupportedSATEvent
  = eventInterfaces.ArrayTableSATEventInterface
    | eventInterfaces.StartArraySATEventInterface
    | eventInterfaces.StartInlineTableSATEventInterface;

const unSupporteds = Object.freeze({
  ignore: "ignore",
  error: "error",
} as const);
type UnSupporteds = typeof unSupporteds[keyof typeof unSupporteds];

const skip = Symbol.for("SATToSAITransformStream.skip");

/**
 * Callback invoked when `SATToSAITransformStream` encounters a TOML construct that cannot be directly represented in INI (`arrayTable`, `startArray`, `startInlineTable`).
 */
export type SATToSAIUnsupportedHandler = (arg: {
  event: UnsupportedSATEvent
  key?: string
  skip: typeof skip
}) => string | typeof skip;

/**
 * Configuration options for `SATToSAITransformStream`.
 */
export type SATToSAITransformStreamOptions = {
  /** Convert `startDocument` / `endDocument` events (default: `true`). */
  makeDocument?: boolean
  /** Forward `comment` events to SAI `comment` events (default: `true`). */
  comments?: boolean
  /** Comment prefix attached to forwarded SAT `comment` events (default: `"#"`). */
  commentPrefix?: string
  /**
   * How to handle TOML constructs without a direct INI representation (`arrayTable`, arrays, inline tables).
   * - `"ignore"` (default): omit the unsupported construct and its contents
   * - `"error"`: error the stream
   * - function: return a replacement `string` (section name for `arrayTable`, or entry value for arrays/inline tables), or return `skip` to omit
   */
  unSupported?: UnSupporteds | SATToSAIUnsupportedHandler
};

type Status = {
  get makeDocument(): boolean
  get comments(): boolean
  get commentPrefix(): string
  get unSupported(): ReturnType<typeof toUnsupported>
};

/**
 * Error thrown by `SATToSAITransformStream` when an unsupported TOML construct or invalid SAT event sequence is encountered.
 */
export class SATToSAITransformStreamError extends Error implements Status {
  makeDocument: boolean;
  comments: boolean;
  commentPrefix: string;
  unSupported: ReturnType<typeof toUnsupported>;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SATToSAITransformStreamError";
    ({
      makeDocument: this.makeDocument,
      comments: this.comments,
      commentPrefix: this.commentPrefix,
      unSupported: this.unSupported,
    } = status);
  }
}

function unSupportedToError({ event }: Parameters<SATToSAIUnsupportedHandler>[0]): never {
  const error = new Error(`Unsupported TOML event for INI: ${event.name}`);
  error.name = "UnSupportedEventError";
  (error as unknown as Record<string, unknown>).event = event;
  throw error;
}

function toUnsupported(unSupported: SATToSAIUnsupportedHandler | typeof skip) {
  if (unSupported === skip) return [unSupporteds.ignore, unSupported] as const;
  if (unSupported === unSupportedToError) return [unSupporteds.error, unSupported] as const;
  return ["custom", unSupported] as const;
}

/**
 * A `TransformStream` that converts SAT (Simple API for TOML) events into SAI (Simple API for INI) events.
 */
export class SATToSAITransformStream extends TransformStream<SATEventInterface, SAIEventInterface> {
  static readonly skip = skip;
  static readonly unSupportedToError = unSupportedToError;

  #makeDocument: boolean;
  #comments: boolean;
  #commentPrefix: string;
  #unSupported: SATToSAIUnsupportedHandler | typeof skip;

  #pendingKey: string | null = null;
  #skippingArrayTable = false;
  #skipContainerDepth = 0;

  constructor(options?: SATToSAITransformStreamOptions) {
    super({
      transform: (event, controller) => {
        this.#transform(event, controller);
      },
      flush: () => {
        this.#flush();
      },
    });
    this.#makeDocument = options?.makeDocument ?? true;
    this.#comments = options?.comments ?? true;
    this.#commentPrefix = options?.commentPrefix ?? "#";
    this.#unSupported = this.#toUnsupported(options?.unSupported);
  }

  #toUnsupported(unSupported?: UnSupporteds | SATToSAIUnsupportedHandler): SATToSAIUnsupportedHandler | typeof skip {
    unSupported ??= unSupporteds.ignore;
    if (unSupported === unSupporteds.ignore) return skip;
    if (unSupported === unSupporteds.error) return unSupportedToError;
    return unSupported;
  }

  #status(): Status {
    return {
      makeDocument: this.#makeDocument,
      comments: this.#comments,
      commentPrefix: this.#commentPrefix,
      unSupported: toUnsupported(this.#unSupported),
    };
  }

  /**
   * Returns the current converter status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SATToSAITransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SATToSAITransformStreamError(message as string, this.#status(), options);
  }

  #handleUnsupported(
    event: UnsupportedSATEvent,
    key?: string,
  ): { skipped: true } | { skipped: false, value: string } {
    if (this.#unSupported === skip) {
      return { skipped: true };
    }
    let replaced: string | typeof skip;
    try {
      replaced = this.#unSupported({ event, ...(key !== undefined ? { key } : {}), skip });
    }
    catch (e: unknown) {
      throw this.#makeError(e);
    }
    if (replaced === skip) {
      return { skipped: true };
    }
    if (typeof replaced !== "string") {
      throw this.#makeError(`unSupported handler must return a string or skip, got ${typeof replaced}`);
    }
    return { skipped: false, value: replaced };
  }

  #transform(
    event: SATEventInterface,
    controller: TransformStreamDefaultController<SAIEventInterface>,
  ): void {
    if (this.#skipContainerDepth > 0) {
      if (event.name === "startArray" || event.name === "startInlineTable") {
        this.#skipContainerDepth++;
      }
      else if (event.name === "endArray" || event.name === "endInlineTable") {
        this.#skipContainerDepth--;
      }
      return;
    }

    switch (event.name) {
      case "startDocument":
        this.#skippingArrayTable = false;
        this.#pendingKey = null;
        if (this.#makeDocument) {
          controller.enqueue(new StartDocumentEvent());
        }
        break;
      case "endDocument":
        if (this.#pendingKey !== null) {
          throw this.#makeError("Unexpected endDocument with pending key");
        }
        this.#skippingArrayTable = false;
        if (this.#makeDocument) {
          controller.enqueue(new EndDocumentEvent());
        }
        break;
      case "comment":
        if (this.#comments && !this.#skippingArrayTable) {
          controller.enqueue(new CommentEvent(event.comment, this.#commentPrefix));
        }
        break;
      case "table":
        if (this.#pendingKey !== null) {
          throw this.#makeError("Unexpected table header while previous key is awaiting value");
        }
        this.#skippingArrayTable = false;
        controller.enqueue(new SectionEvent(event.path.join(".")));
        break;
      case "arrayTable": {
        if (this.#pendingKey !== null) {
          throw this.#makeError("Unexpected arrayTable header while previous key is awaiting value");
        }
        const resolved = this.#handleUnsupported(event);
        if (resolved.skipped) {
          this.#skippingArrayTable = true;
        }
        else {
          this.#skippingArrayTable = false;
          controller.enqueue(new SectionEvent(resolved.value));
        }
        break;
      }
      case "key":
        if (this.#skippingArrayTable) return;
        if (this.#pendingKey !== null) {
          throw this.#makeError("Unexpected key while previous key is awaiting value");
        }
        this.#pendingKey = event.path.join(".");
        break;
      case "startArray":
      case "startInlineTable": {
        if (this.#skippingArrayTable) {
          this.#skipContainerDepth = 1;
          return;
        }
        const key = this.#pendingKey;
        this.#pendingKey = null;
        const resolved = this.#handleUnsupported(event, key ?? undefined);
        if (!resolved.skipped && key !== null) {
          controller.enqueue(new EntryEvent(key, resolved.value));
        }
        this.#skipContainerDepth = 1;
        break;
      }
      case "endArray":
      case "endInlineTable":
        throw this.#makeError(`Unexpected ${event.name}`);
      case "value": {
        if (this.#skippingArrayTable) return;
        if (this.#pendingKey === null) {
          throw this.#makeError("Unexpected value without preceding key");
        }
        const key = this.#pendingKey;
        this.#pendingKey = null;
        const strValue = typeof event.value === "string" ? event.value : String(event.value);
        controller.enqueue(new EntryEvent(key, strValue));
        break;
      }
    }
  }

  #flush(): void {
    if (this.#skipContainerDepth > 0 || this.#pendingKey !== null) {
      throw this.#makeError("Unexpected end of stream with unclosed container or pending key");
    }
  }
}
