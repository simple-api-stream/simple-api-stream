import type { SAIEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

/**
 * Default reconstructed INI object shape.
 */
export type INIObject = Record<string, string | Record<string, string>>;

type Status = {
  get inDocument(): boolean
  get currentSection(): string | null
};

/**
 * Error thrown by `SAIToObjectTransformStream` when an invalid SAI event sequence is encountered.
 */
export class SAIToObjectTransformStreamError extends Error implements Status {
  inDocument: boolean;
  currentSection: string | null;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAIToObjectTransformStreamError";
    ({
      inDocument: this.inDocument,
      currentSection: this.currentSection,
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

function getOwnProperty(target: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
}

/**
 * A `TransformStream` that reconstructs JavaScript objects from a stream of SAI (Simple API for INI) events.
 */
export class SAIToObjectTransformStream<T = INIObject> extends TransformStream<SAIEventInterface, T> {
  #inDocument = false;
  #hasEvents = false;
  #root: Record<string, unknown> = {};
  #currentSection: string | null = null;
  #currentTarget: Record<string, unknown> = this.#root;
  #controller!: TransformStreamDefaultController<T>;

  constructor() {
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
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      inDocument: this.#inDocument,
      currentSection: this.#currentSection,
    };
  }

  /**
   * Returns the current reconstructor status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SAIToObjectTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SAIToObjectTransformStreamError(message as string, this.#status(), options);
  }

  #reset(): void {
    this.#root = {};
    this.#currentSection = null;
    this.#currentTarget = this.#root;
    this.#hasEvents = false;
  }

  #transform(event: SAIEventInterface): void {
    switch (event.name) {
      case "startDocument":
        if (this.#inDocument) {
          throw this.#makeError("Unexpected startDocument while already in document");
        }
        this.#reset();
        this.#inDocument = true;
        break;
      case "endDocument":
        if (!this.#inDocument) {
          throw this.#makeError("Unexpected endDocument outside document");
        }
        this.#inDocument = false;
        this.#controller.enqueue(this.#root as T);
        this.#reset();
        break;
      case "comment":
        break;
      case "section": {
        this.#hasEvents = true;
        this.#currentSection = event.section;
        const existing = getOwnProperty(this.#root, event.section);
        if (typeof existing === "object" && existing !== null) {
          this.#currentTarget = existing as Record<string, unknown>;
        }
        else {
          const sectionObj: Record<string, unknown> = {};
          setOwnProperty(this.#root, event.section, sectionObj);
          this.#currentTarget = sectionObj;
        }
        break;
      }
      case "entry":
        this.#hasEvents = true;
        setOwnProperty(this.#currentTarget, event.key, event.value);
        break;
    }
  }

  #flush(): void {
    if (this.#inDocument) {
      throw this.#makeError("Unexpected end of stream before endDocument");
    }
    if (this.#hasEvents) {
      this.#controller.enqueue(this.#root as T);
      this.#reset();
    }
  }
}
