import type { SAIHandler } from "./interface/index.js";
import type { INITextToSAIParserAdditionalHandler, INITextToSAIParserOptions } from "./INITextToSAIParser.js";
import { INITextToSAIParser } from "./INITextToSAIParser.js";

/**
 * A `WritableStream` that accepts INI text chunks and emits SAI events via handler callbacks.
 */
export class INITextToSAIEventWritableStream extends WritableStream<string> {
  #parser: INITextToSAIParser;

  constructor(
    handler: Partial<SAIHandler & INITextToSAIParserAdditionalHandler>,
    options: INITextToSAIParserOptions = {},
  ) {
    const parser = new INITextToSAIParser({ handler, ...options });
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
