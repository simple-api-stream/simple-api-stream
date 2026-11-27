import type { SAIEventInterface } from "./event-interface/index.js";
import type { SAIHandler } from "./interface/index.js";
import type { INITextToSAIParserAdditionalHandler, INITextToSAIParserOptions } from "./INITextToSAIParser.js";
import { INITextToSAIParser } from "./INITextToSAIParser.js";

/**
 * A `TransformStream` that converts INI text chunks into a stream of SAI events.
 */
export class INITextToSAITransformStream extends TransformStream<string, SAIEventInterface> {
  #parser: INITextToSAIParser;

  constructor(
    options: INITextToSAIParserOptions & { handler?: Partial<INITextToSAIParserAdditionalHandler> } = {},
  ) {
    let parser!: INITextToSAIParser;
    super({
      start: (controller) => {
        const handler = toHandler(controller, options.handler ?? {});
        parser = new INITextToSAIParser({ handler, ...options });
      },
      transform: (chunk: string) => {
        parser.enqueue(chunk);
      },
      flush: () => {
        parser.flush();
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

function toHandler(
  controller: TransformStreamDefaultController<SAIEventInterface>,
  additional: Partial<INITextToSAIParserAdditionalHandler>,
): Partial<SAIHandler & INITextToSAIParserAdditionalHandler> {
  const enqueue = (event: SAIEventInterface) => controller.enqueue(event);
  return {
    ...additional,
    onStartDocument: enqueue,
    onEndDocument: enqueue,
    onComment: enqueue,
    onSection: enqueue,
    onEntry: enqueue,
    onError: (err: unknown) => controller.error(err),
  };
}
