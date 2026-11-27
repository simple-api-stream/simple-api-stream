import type { SAYEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

/**
 * Configuration options for `SAYToObjectTransformStream`.
 */
export type SAYToObjectTransformStreamOptions = {
  /** Allow multiple YAML documents in one stream (default: `true`). */
  multiple?: boolean
};

type ContainerFrame
  = { type: "mapping", target: Record<string, unknown>, pendingKey: string | null }
    | { type: "sequence", target: unknown[] };

type Status = {
  get multiple(): boolean
  get inDocument(): boolean
  get depth(): number
};

/**
 * Error thrown by `SAYToObjectTransformStream` when an invalid SAY event sequence or unknown alias is encountered.
 */
export class SAYToObjectTransformStreamError extends Error implements Status {
  multiple: boolean;
  inDocument: boolean;
  depth: number;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAYToObjectTransformStreamError";
    ({
      multiple: this.multiple,
      inDocument: this.inDocument,
      depth: this.depth,
    } = status);
  }
}

function setOwnProperty(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/**
 * A `TransformStream` that reconstructs JavaScript values from a stream of SAY (Simple API for YAML) events.
 */
export class SAYToObjectTransformStream<T = unknown> extends TransformStream<SAYEventInterface, T> {
  #multiple: boolean;
  #inDocument = false;
  #emittedCount = 0;
  #hasRootValue = false;
  #rootValue: unknown = undefined;
  #stack: ContainerFrame[] = [];
  #anchors = new Map<string, unknown>();
  #controller!: TransformStreamDefaultController<T>;

  constructor(options?: SAYToObjectTransformStreamOptions) {
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
    this.#multiple = options?.multiple ?? true;
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      multiple: this.#multiple,
      inDocument: this.#inDocument,
      depth: this.#stack.length,
    };
  }

  /**
   * Returns the current reconstructor status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SAYToObjectTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SAYToObjectTransformStreamError(message as string, this.#status(), options);
  }

  #resetDocument(): void {
    this.#hasRootValue = false;
    this.#rootValue = undefined;
    this.#stack = [];
    this.#anchors.clear();
  }

  #attachValue(value: unknown, anchor?: string): void {
    if (anchor !== undefined) {
      this.#anchors.set(anchor, value);
    }
    const top = this.#stack[this.#stack.length - 1];
    if (!top) {
      if (this.#hasRootValue) {
        throw this.#makeError("Unexpected second root value in document");
      }
      this.#hasRootValue = true;
      this.#rootValue = value;
      return;
    }
    if (top.type === "sequence") {
      top.target.push(value);
      return;
    }
    if (top.pendingKey === null) {
      throw this.#makeError("Unexpected value without preceding key in mapping");
    }
    setOwnProperty(top.target, top.pendingKey, value);
    top.pendingKey = null;
  }

  #emitCompletedDocument(value: unknown): void {
    if (!this.#multiple && this.#emittedCount >= 1) {
      throw this.#makeError("Multiple YAML documents are not allowed when multiple is false");
    }
    this.#emittedCount++;
    this.#controller.enqueue(value as T);
  }

  #transform(event: SAYEventInterface): void {
    switch (event.name) {
      case "startDocument":
        if (this.#inDocument) {
          throw this.#makeError("Unexpected startDocument while already in document");
        }
        this.#resetDocument();
        this.#inDocument = true;
        break;
      case "endDocument":
        if (!this.#inDocument) {
          throw this.#makeError("Unexpected endDocument outside document");
        }
        if (this.#stack.length > 0) {
          throw this.#makeError("Unexpected endDocument with unclosed collection");
        }
        this.#inDocument = false;
        this.#emitCompletedDocument(this.#hasRootValue ? this.#rootValue : null);
        this.#resetDocument();
        break;
      case "comment":
        break;
      case "startMapping": {
        const target: Record<string, unknown> = {};
        this.#attachValue(target, event.anchor);
        this.#stack.push({ type: "mapping", target, pendingKey: null });
        break;
      }
      case "endMapping": {
        const frame = this.#stack.pop();
        if (!frame || frame.type !== "mapping") {
          throw this.#makeError("Unexpected endMapping");
        }
        if (frame.pendingKey !== null) {
          throw this.#makeError("Unexpected endMapping with pending key");
        }
        break;
      }
      case "startSequence": {
        const target: unknown[] = [];
        this.#attachValue(target, event.anchor);
        this.#stack.push({ type: "sequence", target });
        break;
      }
      case "endSequence": {
        const frame = this.#stack.pop();
        if (!frame || frame.type !== "sequence") {
          throw this.#makeError("Unexpected endSequence");
        }
        break;
      }
      case "key": {
        const top = this.#stack[this.#stack.length - 1];
        if (!top || top.type !== "mapping") {
          throw this.#makeError("Unexpected key outside mapping");
        }
        if (top.pendingKey !== null) {
          throw this.#makeError("Unexpected key while previous key is awaiting value");
        }
        top.pendingKey = event.key;
        break;
      }
      case "scalar":
        this.#attachValue(event.value, event.anchor);
        break;
      case "alias": {
        if (!this.#anchors.has(event.alias)) {
          throw this.#makeError(`Unknown YAML alias: *${event.alias}`);
        }
        this.#attachValue(this.#anchors.get(event.alias));
        break;
      }
    }
  }

  #flush(): void {
    if (this.#inDocument || this.#stack.length > 0) {
      throw this.#makeError("Unexpected end of stream with unclosed document or collection");
    }
    if (this.#hasRootValue) {
      this.#emitCompletedDocument(this.#rootValue);
      this.#resetDocument();
    }
  }
}
