import type { SAYHandler } from "./interface/index.js";
import type { YAMLTextToSAYParserAdditionalHandler, YAMLTextToSAYParserOptions } from "./YAMLTextToSAYParser.js";
import { YAMLTextToSAYParser } from "./YAMLTextToSAYParser.js";

/**
 * A `WritableStream` that accepts YAML text chunks and emits SAY events via handler callbacks.
 */
export class YAMLTextToSAYEventWritableStream extends WritableStream<string> {
  #parser: YAMLTextToSAYParser;

  constructor(
    handler: Partial<SAYHandler & YAMLTextToSAYParserAdditionalHandler>,
    options: YAMLTextToSAYParserOptions = {},
  ) {
    const parser = new YAMLTextToSAYParser({ handler, ...options });
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
