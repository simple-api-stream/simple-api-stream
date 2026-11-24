import { CommentEvent, EndArrayEvent, EndDocumentEvent, EndObjectEvent, KeyEvent, StartArrayEvent, StartDocumentEvent, StartObjectEvent, ValueBooleanEvent, ValueNullEvent, ValueNumberEvent, ValueStringEvent } from "./event/index.js";
import type { SAJEventInterface } from "./event-interface/index.js";
import type { SAJResolver } from "./interface/SAJResolver.js";

/**
 * ReadableStream that emits SAJ events driven imperatively via the `SAJResolver` interface.
 */
export class ResolveToSAJReadableStream extends ReadableStream<SAJEventInterface> implements SAJResolver {
  #controller!: ReadableStreamDefaultController<SAJEventInterface>;
  #closed = false;

  constructor() {
    let controller_!: ReadableStreamDefaultController<SAJEventInterface>;

    super({
      start: (controller) => {
        controller_ = controller;
      },
      cancel: () => {
        this.#closed = true;
      },
    });
    this.#controller = controller_;
  }

  /**
   * Enqueues a `StartObjectEvent`.
   */
  startObject(): void {
    this.#controller.enqueue(new StartObjectEvent());
  }

  /**
   * Enqueues an `EndObjectEvent`.
   */
  endObject(): void {
    this.#controller.enqueue(new EndObjectEvent());
  }

  /**
   * Enqueues a `StartArrayEvent`.
   */
  startArray(): void {
    this.#controller.enqueue(new StartArrayEvent());
  }

  /**
   * Enqueues an `EndArrayEvent`.
   */
  endArray(): void {
    this.#controller.enqueue(new EndArrayEvent());
  }

  /**
   * Enqueues a `KeyEvent` for an object property name.
   */
  key(key: string): void {
    this.#controller.enqueue(new KeyEvent(key));
  }

  /**
   * Enqueues a typed JSON primitive value event (`boolean`, `string`, `number`, or `null`).
   */
  value<T extends "string" | "number" | "null" | "boolean">(type: T, value: { number: number, string: string, null: null, boolean: boolean }[T]): void {
    if (type === "boolean") {
      this.#controller.enqueue(new ValueBooleanEvent(type, value as boolean));
      return;
    }
    else if (type === "string") {
      this.#controller.enqueue(new ValueStringEvent(type, value as string));
      return;
    }
    else if (type === "number") {
      this.#controller.enqueue(new ValueNumberEvent(type, value as number));
      return;
    }
    this.#controller.enqueue(new ValueNullEvent(type));
  }

  /**
   * Enqueues a `CommentEvent`.
   */
  comment(comment: string, style?: "line" | "block"): void {
    this.#controller.enqueue(new CommentEvent(comment, style));
  }

  /**
   * Enqueues a `StartDocumentEvent`.
   */
  startDocument(): void {
    this.#controller.enqueue(new StartDocumentEvent());
  }

  /**
   * Enqueues an `EndDocumentEvent`.
   */
  endDocument(): void {
    this.#controller.enqueue(new EndDocumentEvent());
  }

  /**
   * Closes the underlying `ReadableStream` controller.
   */
  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#controller.close();
  }

  /**
   * Disposes the stream by closing it.
   */
  [Symbol.dispose]() {
    this.close();
  }
}
