import { assertIsDefined, toErrorMessage } from "./utils/index.js";
import type { SAJEventInterface } from "./event-interface/index.js";

type SAJStateFn = (event: SAJEventInterface) => void;

type Status = {
  get state(): string
  get stackedList(): {
    get container(): unknown
    key?: string | undefined
  }[]
  get current(): unknown
};

/**
 * Error thrown by `SAJToObjectTransformStream` when an invalid or incomplete SAJ event sequence is encountered.
 */
export class SAJToObjectTransformStreamError extends Error implements Status {
  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAJToObjectTransformStreamError";
    this.state = status.state;
    this.stackedList = status.stackedList;
    this.current = status.current;
  }

  state: string;
  stackedList: { container: unknown, key?: string | undefined }[];
  current: unknown;
}

/**
 * Configuration options for `SAJToObjectTransformStream`.
 */
export type SAJToObjectTransformStreamOptions = {
  multiple: boolean
};

/**
 * TransformStream that reconstructs JavaScript values/objects from a stream of SAJ events.
 */
export class SAJToObjectTransformStream<T> extends TransformStream<SAJEventInterface, T> {
  #controller!: TransformStreamDefaultController<T>;
  #multiple: boolean;
  #inDocument: boolean = false;

  constructor(options?: Partial<SAJToObjectTransformStreamOptions>) {
    let controller_!: TransformStreamDefaultController<T>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#next(chunk);
      },
      flush: () => {
        if (this.#stack.length === 0 && !this.#inDocument) return;
        throw this.#makeError("Incomplete JSON structure");
      },
    });
    ({ multiple: this.#multiple = false } = options ?? {});
    this.#controller = controller_;
  }

  #makeError(message: string | Error, options?: ErrorOptions) {
    ({ message, options } = toErrorMessage(message, options));
    const status = this.#status();
    return new SAJToObjectTransformStreamError(message, status, options);
  }

  get #current(): unknown {
    const top = this.#stack.at(-1);
    return top?.container;
  }

  #status(): Status {
    return {
      state: this.#stateName,
      stackedList: structuredClone(this.#stack),
      current: structuredClone(this.#current),
    };
  }

  /**
   * Returns the current reconstructor status snapshot.
   */
  get status() {
    return this.#status();
  }

  #next(chunk: SAJEventInterface) {
    try {
      if (chunk.name === "comment") {
        return;
      }
      if (chunk.name === "error") {
        this.#stack = [];
        this.#setState(this.#startEntry, "startEntry");
        return;
      }
      this.#state(chunk);
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }

  // ========== State and construction stacks ==========
  #state: SAJStateFn = this.#startEntry;
  #stateName = "startEntry";
  #stack: { container: unknown, key?: string }[] = [];

  #setState(state: SAJStateFn, name: string) {
    this.#state = state;
    this.#stateName = name;
  }

  // #region State functions
  #startEntry(event: SAJEventInterface): void {
    switch (event.name) {
      case "startDocument":
        if (this.#inDocument) break;
        this.#inDocument = true;
        return;
      case "endDocument":
        if (!this.#inDocument) break;
        this.#inDocument = false;
        return;
      case "startObject": {
        const container: unknown = {};
        this.#stack.push({ container });
        this.#setState(this.#inObject, "inObject");
        return;
      }
      case "startArray": {
        const container: unknown[] = [];
        this.#stack.push({ container });
        this.#setState(this.#inArray, "inArray");
        return;
      }

      case "value":
        this.#endEntry(event.value);
        return;
    }

    throw this.#makeError(`Unexpected ${event.name} at root`, {
      cause: {
        name: event.name,
      },
    });
  }

  #inObject(event: SAJEventInterface): void {
    const top = this.#stack.at(-1);
    assertIsDefined(top, "required top");

    switch (event.name) {
      case "key":
        top.key = event.key;
        this.#setState(this.#inObjectExpectingValue, "inObjectExpectingValue");
        return;

      case "endObject": {
        this.#stack.pop();
        const obj = top.container;
        if (this.#stack.length > 0) {
          this.#attachValue(obj);
          return;
        }
        this.#endEntry(obj);
        return;
      }
    }

    const error = this.#makeError(`Unexpected ${event.name} in object`);
    (error as unknown as Record<string, unknown>).eventName = event.name;
    throw error;
  }

  #setPropertyValue(obj: Record<string, unknown>, key: string, value: unknown): void {
    Reflect.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  #inObjectExpectingValue(event: SAJEventInterface): void {
    const top = this.#stack.at(-1);
    assertIsDefined(top, "required top");
    const key = top.key!;
    const obj = top.container as Record<string, unknown>;

    switch (event.name) {
      case "value":
        this.#setPropertyValue(obj, key, event.value);
        top.key = undefined;
        this.#setState(this.#inObject, "inObject");
        return;

      case "startObject": {
        const newObj: Record<string, unknown> = {};
        this.#setPropertyValue(obj, key, newObj);
        this.#stack.push({ container: newObj });
        this.#setState(this.#inObject, "inObject");
        return;
      }
      case "startArray": {
        const newArr: unknown[] = [];
        this.#setPropertyValue(obj, key, newArr);
        this.#stack.push({ container: newArr });
        this.#setState(this.#inArray, "inArray");
        return;
      }
    }
    throw this.#makeError(`Unexpected ${event.name} after key`);
  }

  #inArray(event: SAJEventInterface): void {
    const top = this.#stack.at(-1);
    assertIsDefined(top, "required top");
    const arr = top.container as unknown[];

    switch (event.name) {
      case "value":
        arr.push(event.value);
        return;

      case "startObject": {
        const newObj: unknown = {};
        this.#stack.push({ container: newObj });
        this.#setState(this.#inObject, "inObject");
        return;
      }

      case "startArray": {
        const newArr: unknown[] = [];
        this.#stack.push({ container: newArr });
        this.#setState(this.#inArray, "inArray");
        return;
      }

      case "endArray": {
        this.#stack.pop();
        const finished = arr;
        if (this.#stack.length > 0) {
          this.#attachValue(finished);
          return;
        }
        this.#endEntry(finished);
        return;
      }
    }

    const error = this.#makeError(`Unexpected ${event.name} in array`);
    (error as unknown as Record<string, unknown>).eventName = event.name;
    throw error;
  }

  #done(event: SAJEventInterface): void {
    if (this.#inDocument && event.name === "endDocument") {
      this.#inDocument = false;
      return;
    }
    throw this.#makeError("Unexpected event after document complete");
  };

  // #endregion

  #endEntry(finished: unknown) {
    this.#controller.enqueue(finished as T);
    if (this.#multiple)
      this.#setState(this.#startEntry, "startEntry");
    else
      this.#setState(this.#done, "done");
  }

  #attachValue(value: unknown) {
    const top = this.#stack.at(-1);
    assertIsDefined(top, "required top");
    if (Array.isArray(top.container)) {
      top.container.push(value);
      this.#setState(this.#inArray, "inArray");
      return;
    }
    const key = top.key!;
    this.#setPropertyValue(top.container as Record<string, unknown>, key, value);
    top.key = undefined;
    this.#setState(this.#inObject, "inObject");
  }
}
