import type { CSVTextToSACParserAdditionalHandler, CSVTextToSACParserOptions } from "./CSVTextToSACParser.js";
import { CSVTextToSACParser } from "./CSVTextToSACParser.js";
import type { SACHandler } from "./interface/index.js";

/**
 * A `WritableStream` that accepts CSV text chunks and emits SAC events via handler callbacks.
 */
export class CSVTextToSACEventWritableStream extends WritableStream<string> {
  #parser: CSVTextToSACParser;

  constructor(
    handler: Partial<SACHandler & CSVTextToSACParserAdditionalHandler>,
    options: CSVTextToSACParserOptions = {},
  ) {
    const parser = new CSVTextToSACParser({ handler, ...options });
    super({
      write: (chunk: string) => {
        parser.enqueue(chunk);
      },
      close: () => {
        parser.flush();
      },
      abort: (reason: unknown) => {
        handler.onError?.(reason);
      },
    });
    this.#parser = parser;
  }

  /**
   * Returns the current parser status snapshot.
   */
  get status() {
    return this.#parser.status;
  }
}
