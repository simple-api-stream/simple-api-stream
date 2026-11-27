import {
  CommentEvent,
  EndDocumentEvent,
  EntryEvent,
  SectionEvent,
  StartDocumentEvent,
} from "./event/index.js";
import type { SAIEventInterface } from "./event-interface/index.js";
import type { SAIResolver } from "./interface/index.js";

/**
 * A `ReadableStream` that allows programmatic emission of SAI events via `SAIResolver` methods.
 */
export class ResolveToSAIReadableStream extends ReadableStream<SAIEventInterface> implements SAIResolver {
  #controller: ReadableStreamDefaultController<SAIEventInterface>;
  #closed = false;

  constructor(resolver?: (resolve: SAIResolver) => void | Promise<void>) {
    let controller_!: ReadableStreamDefaultController<SAIEventInterface>;
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
   * Enqueues a `SectionEvent`.
   */
  section(...args: ConstructorParameters<typeof SectionEvent>): void {
    this.#controller.enqueue(new SectionEvent(...args));
  }

  /**
   * Enqueues an `EntryEvent`.
   */
  entry(...args: ConstructorParameters<typeof EntryEvent>): void {
    this.#controller.enqueue(new EntryEvent(...args));
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
