import {
  CommentEvent,
  EndDocumentEvent,
  SSEMessageEvent,
  StartDocumentEvent,
  type SSEEventInterface,
} from "./events.js";

/**
 * Configuration options for `SSETextToEventTransformStream`.
 */
export type SSETextToEventTransformStreamOptions = {
  /** Do not emit `startDocument` / `endDocument` events (default: `false`). */
  skipDocument?: boolean
  /** Emit `comment` events for `: ...` comment lines (default: `false`). */
  comments?: boolean
  /** Strip a leading UTF-8 BOM (`\uFEFF`) at the start of the stream (default: `true`). */
  stripBom?: boolean
  /**
   * Dispatch a pending event with non-empty `data` buffer if the stream ends without a trailing blank line (default: `false`, matching the WHATWG SSE specification).
   */
  flushIncomplete?: boolean
};

const DIGITS_REGEX = /^[0-9]+$/;

/**
 * A `TransformStream` that incrementally parses `text/event-stream` (Server-Sent Events) text chunks into `SSEEventInterface` objects.
 */
export class SSETextToEventTransformStream extends TransformStream<string, SSEEventInterface> {
  #skipDocument: boolean;
  #comments: boolean;
  #stripBom: boolean;
  #flushIncomplete: boolean;
  #started = false;
  #bomChecked = false;
  #lineBuffer = "";
  #pendingCR = false;
  #dataLines: string[] = [];
  #eventType = "";
  #lastEventId: string | undefined = undefined;
  #retry: number | undefined = undefined;
  #controller!: TransformStreamDefaultController<SSEEventInterface>;

  constructor(options?: SSETextToEventTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<SSEEventInterface>;
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
    this.#skipDocument = options?.skipDocument ?? false;
    this.#comments = options?.comments ?? false;
    this.#stripBom = options?.stripBom ?? true;
    this.#flushIncomplete = options?.flushIncomplete ?? false;
    this.#controller = controller_;
  }

  #ensureStarted(): void {
    if (!this.#started) {
      this.#started = true;
      if (!this.#skipDocument) {
        this.#controller.enqueue(new StartDocumentEvent());
      }
    }
  }

  #dispatch(): void {
    if (this.#dataLines.length > 0) {
      this.#controller.enqueue(new SSEMessageEvent({
        data: this.#dataLines.join("\n"),
        event: this.#eventType.length > 0 ? this.#eventType : undefined,
        id: this.#lastEventId,
        retry: this.#retry,
      }));
    }
    this.#dataLines = [];
    this.#eventType = "";
    this.#retry = undefined;
  }

  #processLine(line: string): void {
    if (line.length === 0) {
      this.#dispatch();
      return;
    }
    if (line.startsWith(":")) {
      if (this.#comments) {
        this.#controller.enqueue(new CommentEvent(line.slice(1)));
      }
      return;
    }
    const colon = line.indexOf(":");
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = "";
    }
    else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(" ")) {
        value = value.slice(1);
      }
    }

    switch (field) {
      case "data":
        this.#dataLines.push(value);
        break;
      case "event":
        this.#eventType = value;
        break;
      case "id":
        if (!value.includes("\0")) {
          this.#lastEventId = value;
        }
        break;
      case "retry":
        if (DIGITS_REGEX.test(value)) {
          this.#retry = Number(value);
        }
        break;
    }
  }

  #transform(chunk: string): void {
    if (chunk.length === 0) return;
    this.#ensureStarted();

    let text = chunk;
    if (!this.#bomChecked) {
      this.#bomChecked = true;
      if (this.#stripBom && text.startsWith("\uFEFF")) {
        text = text.slice(1);
      }
    }

    let i = 0;
    if (this.#pendingCR) {
      this.#pendingCR = false;
      if (text[0] === "\n") {
        i = 1;
      }
    }

    let start = i;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === "\n" || ch === "\r") {
        const line = this.#lineBuffer + text.slice(start, i);
        this.#lineBuffer = "";
        this.#processLine(line);
        if (ch === "\r") {
          if (i + 1 < text.length) {
            if (text[i + 1] === "\n") {
              i++;
            }
          }
          else {
            this.#pendingCR = true;
          }
        }
        start = i + 1;
      }
    }
    if (start < text.length) {
      this.#lineBuffer += text.slice(start);
    }
  }

  #flush(): void {
    if (this.#lineBuffer.length > 0) {
      const remaining = this.#lineBuffer;
      this.#lineBuffer = "";
      this.#processLine(remaining);
    }
    if (this.#flushIncomplete) {
      this.#dispatch();
    }
    if (this.#started && !this.#skipDocument) {
      this.#controller.enqueue(new EndDocumentEvent());
    }
  }
}
