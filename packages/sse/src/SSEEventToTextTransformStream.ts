import type { SSEEventInterface } from "./event-interface/index.js";

/**
 * Configuration options for `SSEEventToTextTransformStream`.
 */
export type SSEEventToTextTransformStreamOptions = {
  /** Line break sequence used in serialized output (default: `"\n"`). */
  lineBreak?: string
  /** Serialize `comment` events as `: ...` lines (default: `false`). */
  comments?: boolean
};

const LINE_SPLIT_REGEX = /\r\n|\r|\n/;

/**
 * A `TransformStream` that serializes `SSEEventInterface` objects into `text/event-stream` text chunks.
 */
export class SSEEventToTextTransformStream extends TransformStream<SSEEventInterface, string> {
  #lineBreak: string;
  #comments: boolean;
  #controller!: TransformStreamDefaultController<string>;

  constructor(options?: SSEEventToTextTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<string>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#transform(chunk);
      },
    });
    this.#lineBreak = options?.lineBreak ?? "\n";
    this.#comments = options?.comments ?? false;
    this.#controller = controller_;
  }

  #transform(event: SSEEventInterface): void {
    const lb = this.#lineBreak;
    switch (event.name) {
      case "startDocument":
      case "endDocument":
        return;
      case "comment": {
        if (!this.#comments) return;
        const lines = event.comment.split(LINE_SPLIT_REGEX);
        this.#controller.enqueue(lines.map(l => `:${l}${lb}`).join(""));
        return;
      }
      case "message": {
        const parts: string[] = [];
        if (event.event !== undefined) {
          parts.push(`event: ${event.event}${lb}`);
        }
        if (event.id !== undefined) {
          parts.push(`id: ${event.id}${lb}`);
        }
        if (event.retry !== undefined) {
          parts.push(`retry: ${event.retry}${lb}`);
        }
        for (const line of event.data.split(LINE_SPLIT_REGEX)) {
          parts.push(`data: ${line}${lb}`);
        }
        parts.push(lb);
        this.#controller.enqueue(parts.join(""));
        return;
      }
    }
  }
}
