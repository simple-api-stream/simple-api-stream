import {
  AliasEvent,
  CommentEvent,
  EndDocumentEvent,
  EndMappingEvent,
  EndSequenceEvent,
  KeyEvent,
  ScalarEvent,
  StartDocumentEvent,
  StartMappingEvent,
  StartSequenceEvent,
} from "./event/index.js";
import type { SAYEventInterface, ScalarValueType } from "./event-interface/index.js";
import type { SAYResolver } from "./interface/index.js";

/**
 * A `ReadableStream` that allows programmatic emission of SAY events via `SAYResolver` methods.
 */
export class ResolveToSAYReadableStream extends ReadableStream<SAYEventInterface> implements SAYResolver {
  #controller: ReadableStreamDefaultController<SAYEventInterface>;
  #closed = false;

  constructor(resolver?: (resolve: SAYResolver) => void | Promise<void>) {
    let controller_!: ReadableStreamDefaultController<SAYEventInterface>;
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

  startDocument(...args: ConstructorParameters<typeof StartDocumentEvent>): void {
    this.#controller.enqueue(new StartDocumentEvent(...args));
  }

  endDocument(...args: ConstructorParameters<typeof EndDocumentEvent>): void {
    this.#controller.enqueue(new EndDocumentEvent(...args));
  }

  comment(...args: ConstructorParameters<typeof CommentEvent>): void {
    this.#controller.enqueue(new CommentEvent(...args));
  }

  startMapping(...args: ConstructorParameters<typeof StartMappingEvent>): void {
    this.#controller.enqueue(new StartMappingEvent(...args));
  }

  endMapping(...args: ConstructorParameters<typeof EndMappingEvent>): void {
    this.#controller.enqueue(new EndMappingEvent(...args));
  }

  startSequence(...args: ConstructorParameters<typeof StartSequenceEvent>): void {
    this.#controller.enqueue(new StartSequenceEvent(...args));
  }

  endSequence(...args: ConstructorParameters<typeof EndSequenceEvent>): void {
    this.#controller.enqueue(new EndSequenceEvent(...args));
  }

  key(...args: ConstructorParameters<typeof KeyEvent>): void {
    this.#controller.enqueue(new KeyEvent(...args));
  }

  scalar<VT extends ScalarValueType>(...args: ConstructorParameters<typeof ScalarEvent<VT>>): void {
    this.#controller.enqueue(new ScalarEvent(...args).toInterface());
  }

  alias(...args: ConstructorParameters<typeof AliasEvent>): void {
    this.#controller.enqueue(new AliasEvent(...args));
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#controller.close();
  }

  [Symbol.dispose](): void {
    this.close();
  }
}
