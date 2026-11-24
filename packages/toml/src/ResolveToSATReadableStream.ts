import {
  ArrayTableEvent,
  CommentEvent,
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
import type { SATEventInterface, ValueType } from "./event-interface/index.js";
import type { SATResolver } from "./interface/index.js";

/**
 * A `ReadableStream` that allows programmatic emission of SAT events via `SATResolver` methods.
 */
export class ResolveToSATReadableStream extends ReadableStream<SATEventInterface> implements SATResolver {
  #controller: ReadableStreamDefaultController<SATEventInterface>;
  #closed = false;

  constructor(resolver?: (resolve: SATResolver) => void | Promise<void>) {
    let controller_!: ReadableStreamDefaultController<SATEventInterface>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      cancel: () => {
        this.#closed = true;
      },
    });
    this.#controller = controller_;
    if (resolver) {
      Promise.resolve(resolver(this)).then(() => {
        this.close();
      }, (err) => {
        if (!this.#closed) {
          this.#closed = true;
          this.#controller.error(err);
        }
      });
    }
  }

  /**
   * Enqueues a `StartDocumentEvent`.
   */
  startDocument(...args: ConstructorParameters<typeof StartDocumentEvent>): void {
    this.#controller.enqueue(new StartDocumentEvent(...args));
  }

  /**
   * Enqueues an `EndDocumentEvent`.
   */
  endDocument(...args: ConstructorParameters<typeof EndDocumentEvent>): void {
    this.#controller.enqueue(new EndDocumentEvent(...args));
  }

  /**
   * Enqueues a `CommentEvent`.
   */
  comment(...args: ConstructorParameters<typeof CommentEvent>): void {
    this.#controller.enqueue(new CommentEvent(...args));
  }

  /**
   * Enqueues a `TableEvent`.
   */
  table(...args: ConstructorParameters<typeof TableEvent>): void {
    this.#controller.enqueue(new TableEvent(...args));
  }

  /**
   * Enqueues an `ArrayTableEvent`.
   */
  arrayTable(...args: ConstructorParameters<typeof ArrayTableEvent>): void {
    this.#controller.enqueue(new ArrayTableEvent(...args));
  }

  /**
   * Enqueues a `KeyEvent`.
   */
  key(...args: ConstructorParameters<typeof KeyEvent>): void {
    this.#controller.enqueue(new KeyEvent(...args));
  }

  /**
   * Enqueues a `StartInlineTableEvent`.
   */
  startInlineTable(...args: ConstructorParameters<typeof StartInlineTableEvent>): void {
    this.#controller.enqueue(new StartInlineTableEvent(...args));
  }

  /**
   * Enqueues an `EndInlineTableEvent`.
   */
  endInlineTable(...args: ConstructorParameters<typeof EndInlineTableEvent>): void {
    this.#controller.enqueue(new EndInlineTableEvent(...args));
  }

  /**
   * Enqueues a `StartArrayEvent`.
   */
  startArray(...args: ConstructorParameters<typeof StartArrayEvent>): void {
    this.#controller.enqueue(new StartArrayEvent(...args));
  }

  /**
   * Enqueues an `EndArrayEvent`.
   */
  endArray(...args: ConstructorParameters<typeof EndArrayEvent>): void {
    this.#controller.enqueue(new EndArrayEvent(...args));
  }

  /**
   * Enqueues a `ValueEvent`.
   */
  value<VT extends ValueType>(...args: ConstructorParameters<typeof ValueEvent<VT>>): void {
    this.#controller.enqueue(new ValueEvent(...args));
  }

  /**
   * Closes the underlying `ReadableStream` controller.
   */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#controller.close();
  }

  /**
   * Disposes the stream by closing it.
   */
  [Symbol.dispose](): void {
    this.close();
  }
}
