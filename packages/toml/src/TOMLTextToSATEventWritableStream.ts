import type { SATHandler } from "./interface/index.js";
import type { TOMLTextToSATParserAdditionalHandler, TOMLTextToSATParserOptions } from "./TOMLTextToSATParser.js";
import { TOMLTextToSATParser } from "./TOMLTextToSATParser.js";

/**
 * A `WritableStream` that accepts TOML text chunks and emits SAT events via handler callbacks.
 */
export class TOMLTextToSATEventWritableStream extends WritableStream<string> {
  #parser: TOMLTextToSATParser;

  constructor(
    handler: Partial<SATHandler & TOMLTextToSATParserAdditionalHandler>,
    options: TOMLTextToSATParserOptions = {},
  ) {
    const parser = new TOMLTextToSATParser({ handler, ...options });
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
