import type { SATEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

type ContainerFrame
  = { type: "array", target: unknown[] }
    | { type: "inlineTable", target: Record<string, unknown>, pendingPath: string[] | null };

type Status = {
  get inDocument(): boolean
  get tablePath(): string[]
};

/**
 * Error thrown by `SATToObjectTransformStream` when an invalid SAT event sequence or key conflict is encountered.
 */
export class SATToObjectTransformStreamError extends Error implements Status {
  inDocument: boolean;
  tablePath: string[];

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SATToObjectTransformStreamError";
    ({
      inDocument: this.inDocument,
      tablePath: this.tablePath,
    } = status);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A `TransformStream` that reconstructs JavaScript objects from a stream of SAT events.
 */
export class SATToObjectTransformStream<T = Record<string, unknown>> extends TransformStream<SATEventInterface, T> {
  #root: Record<string, unknown> = {};
  #currentTable: Record<string, unknown> = this.#root;
  #currentTablePath: string[] = [];
  #pendingKeyPath: string[] | null = null;
  #stack: ContainerFrame[] = [];
  #inDocument = false;
  #hasContent = false;
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
      tablePath: this.#currentTablePath.slice(),
    };
  }

  /**
   * Returns the current reconstructor status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: string | Error, options?: ErrorOptions): SATToObjectTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SATToObjectTransformStreamError(message, this.#status(), options);
  }

  #reset(): void {
    this.#root = {};
    this.#currentTable = this.#root;
    this.#currentTablePath = [];
    this.#pendingKeyPath = null;
    this.#stack = [];
    this.#hasContent = false;
  }

  #navigateTable(path: string[], isArrayTable: boolean): Record<string, unknown> {
    let curr: Record<string, unknown> = this.#root;
    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i];
      const existing = curr[seg];
      if (existing === undefined) {
        const next: Record<string, unknown> = {};
        Reflect.defineProperty(curr, seg, { value: next, writable: true, enumerable: true, configurable: true });
        curr = next;
      }
      else if (Array.isArray(existing)) {
        const last: unknown = existing[existing.length - 1];
        if (!isPlainObject(last)) {
          throw this.#makeError(`Cannot navigate through non-table array element at "${seg}"`);
        }
        curr = last;
      }
      else if (isPlainObject(existing)) {
        curr = existing;
      }
      else {
        throw this.#makeError(`Key "${seg}" is already defined as a non-table value`);
      }
    }

    const lastSeg = path[path.length - 1];
    const existing = curr[lastSeg];
    if (isArrayTable) {
      if (existing === undefined) {
        const arr: Record<string, unknown>[] = [];
        Reflect.defineProperty(curr, lastSeg, { value: arr, writable: true, enumerable: true, configurable: true });
        const item: Record<string, unknown> = {};
        arr.push(item);
        return item;
      }
      if (!Array.isArray(existing)) {
        throw this.#makeError(`Key "${lastSeg}" is already defined as a non-array value`);
      }
      const item: Record<string, unknown> = {};
      existing.push(item);
      return item;
    }

    if (existing === undefined) {
      const tbl: Record<string, unknown> = {};
      Reflect.defineProperty(curr, lastSeg, { value: tbl, writable: true, enumerable: true, configurable: true });
      return tbl;
    }
    if (!isPlainObject(existing)) {
      throw this.#makeError(`Key "${lastSeg}" is already defined as a non-table value`);
    }
    return existing;
  }

  #setAtPath(base: Record<string, unknown>, path: string[], value: unknown): void {
    let curr = base;
    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i];
      const existing = curr[seg];
      if (existing === undefined) {
        const next: Record<string, unknown> = {};
        Reflect.defineProperty(curr, seg, { value: next, writable: true, enumerable: true, configurable: true });
        curr = next;
      }
      else if (isPlainObject(existing)) {
        curr = existing;
      }
      else {
        throw this.#makeError(`Cannot set dotted key through non-table "${seg}"`);
      }
    }
    const lastSeg = path[path.length - 1];
    if (Object.hasOwn(curr, lastSeg)) {
      throw this.#makeError(`Duplicate key "${path.join(".")}"`);
    }
    Reflect.defineProperty(curr, lastSeg, { value: value, writable: true, enumerable: true, configurable: true });
  }

  #assignValue(value: unknown): void {
    const top = this.#stack[this.#stack.length - 1];
    if (top?.type === "array") {
      top.target.push(value);
      return;
    }
    if (top?.type === "inlineTable") {
      if (!top.pendingPath) {
        throw this.#makeError("Value without key in inline table");
      }
      this.#setAtPath(top.target, top.pendingPath, value);
      top.pendingPath = null;
      return;
    }
    if (!this.#pendingKeyPath) {
      throw this.#makeError("Value without key");
    }
    this.#setAtPath(this.#currentTable, this.#pendingKeyPath, value);
    this.#pendingKeyPath = null;
  }

  #transform(event: SATEventInterface): void {
    switch (event.name) {
      case "startDocument":
        if (this.#inDocument) {
          throw this.#makeError("Unexpected startDocument while already in document");
        }
        this.#inDocument = true;
        this.#reset();
        break;
      case "endDocument":
        if (!this.#inDocument) {
          throw this.#makeError("Unexpected endDocument outside document");
        }
        if (this.#stack.length > 0 || this.#pendingKeyPath !== null) {
          throw this.#makeError("Unexpected endDocument with unclosed container or pending key");
        }
        this.#inDocument = false;
        this.#controller.enqueue(this.#root as T);
        this.#reset();
        break;
      case "comment":
        break;
      case "table":
        this.#hasContent = true;
        this.#currentTable = this.#navigateTable(event.path, false);
        this.#currentTablePath = event.path.slice();
        break;
      case "arrayTable":
        this.#hasContent = true;
        this.#currentTable = this.#navigateTable(event.path, true);
        this.#currentTablePath = event.path.slice();
        break;
      case "key": {
        this.#hasContent = true;
        const top = this.#stack[this.#stack.length - 1];
        if (top?.type === "inlineTable") {
          top.pendingPath = event.path;
        }
        else {
          this.#pendingKeyPath = event.path;
        }
        break;
      }
      case "startArray": {
        this.#hasContent = true;
        const arr: unknown[] = [];
        this.#assignValue(arr);
        this.#stack.push({ type: "array", target: arr });
        break;
      }
      case "endArray": {
        const top = this.#stack.pop();
        if (top?.type !== "array") {
          throw this.#makeError("Unexpected endArray");
        }
        break;
      }
      case "startInlineTable": {
        this.#hasContent = true;
        const tbl: Record<string, unknown> = {};
        this.#assignValue(tbl);
        this.#stack.push({ type: "inlineTable", target: tbl, pendingPath: null });
        break;
      }
      case "endInlineTable": {
        const top = this.#stack.pop();
        if (top?.type !== "inlineTable") {
          throw this.#makeError("Unexpected endInlineTable");
        }
        break;
      }
      case "value":
        this.#hasContent = true;
        this.#assignValue(event.value);
        break;
    }
  }

  #flush(): void {
    if (this.#stack.length > 0 || this.#pendingKeyPath !== null) {
      throw this.#makeError("Unexpected end of stream with unclosed container or pending key");
    }
    if (this.#hasContent && !this.#inDocument) {
      this.#controller.enqueue(this.#root as T);
      this.#reset();
    }
  }
}
