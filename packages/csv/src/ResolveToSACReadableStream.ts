import {
  ColumnEvent,
  EndDocumentEvent,
  EndHeaderRowEvent,
  EndRecordRowEvent,
  StartDocumentEvent,
  StartHeaderRowEvent,
  StartRecordRowEvent,
  type ColumnEventOptions,
} from "./event/index.js";
import type { SACEventInterface } from "./event-interface/index.js";
import type { SACResolver } from "./interface/index.js";
import { toErrorMessage } from "./utils/index.js";

type Status = {
  get rowMode(): "header" | "record" | null
  get colIndex(): number
};

/**
 * Error thrown by `ResolveToSACReadableStream` when an invalid operation occurs.
 */
export class ResolveToSACReadableStreamError extends Error implements Status {
  rowMode: "header" | "record" | null;
  colIndex: number;
  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResolveToSACReadableStreamError";
    this.rowMode = status.rowMode;
    this.colIndex = status.colIndex;
  }
}

/**
 * A `ReadableStream` that allows constructing and emitting SAC events imperatively via `SACResolver`.
 */
export class ResolveToSACReadableStream extends ReadableStream<SACEventInterface> implements SACResolver {
  #controller!: ReadableStreamDefaultController<SACEventInterface>;
  #closed = false;
  #rowMode: "header" | "record" | null = null;
  #colIndex = 0;
  #headers: string[] = [];

  constructor() {
    let controller_!: ReadableStreamDefaultController<SACEventInterface>;
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

  #status(): Status {
    return {
      rowMode: this.#rowMode,
      colIndex: this.#colIndex,
    };
  }

  #makeError(message: string | Error, options?: ErrorOptions): ResolveToSACReadableStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new ResolveToSACReadableStreamError(message, this.#status(), options);
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
   * Enqueues a `StartHeaderRowEvent` and begins tracking header columns.
   */
  startHeaderRow(): void {
    if (this.#rowMode !== null) {
      throw this.#makeError(`Cannot startHeaderRow while ${this.#rowMode} row is open`);
    }
    this.#rowMode = "header";
    this.#colIndex = 0;
    this.#headers = [];
    this.#controller.enqueue(new StartHeaderRowEvent());
  }

  /**
   * Enqueues an `EndHeaderRowEvent` and closes the current header row.
   */
  endHeaderRow(): void {
    if (this.#rowMode !== "header") {
      throw this.#makeError("Cannot endHeaderRow when no header row is open");
    }
    this.#rowMode = null;
    this.#controller.enqueue(new EndHeaderRowEvent());
  }

  /**
   * Enqueues a `StartRecordRowEvent` and begins tracking record columns.
   */
  startRecordRow(): void {
    if (this.#rowMode !== null) {
      throw this.#makeError(`Cannot startRecordRow while ${this.#rowMode} row is open`);
    }
    this.#rowMode = "record";
    this.#colIndex = 0;
    this.#controller.enqueue(new StartRecordRowEvent());
  }

  /**
   * Enqueues an `EndRecordRowEvent` and closes the current record row.
   */
  endRecordRow(): void {
    if (this.#rowMode !== "record") {
      throw this.#makeError("Cannot endRecordRow when no record row is open");
    }
    this.#rowMode = null;
    this.#controller.enqueue(new EndRecordRowEvent());
  }

  /**
   * Enqueues a `ColumnEvent` for the current row, resolving `index` and `header` automatically when applicable.
   */
  column(value: string, options?: ColumnEventOptions): void {
    const index = options?.index ?? (this.#rowMode !== null ? this.#colIndex++ : undefined);
    let header = options?.header;
    if (this.#rowMode === "header") {
      this.#headers.push(value);
    }
    else if (this.#rowMode === "record" && header === undefined && index !== undefined) {
      header = this.#headers[index];
    }
    this.#controller.enqueue(new ColumnEvent(value, { ...options, index, header }));
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
