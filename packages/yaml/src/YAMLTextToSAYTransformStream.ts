import type { SAYEventInterface } from "./event-interface/index.js";
import type { SAYHandler } from "./interface/index.js";
import type { YAMLTextToSAYParserAdditionalHandler, YAMLTextToSAYParserOptions } from "./YAMLTextToSAYParser.js";
import { YAMLTextToSAYParser } from "./YAMLTextToSAYParser.js";

/**
 * A `TransformStream` that converts YAML text chunks into a stream of SAY events.
 */
export class YAMLTextToSAYTransformStream extends TransformStream<string, SAYEventInterface> {
  #parser: YAMLTextToSAYParser;

  constructor(
    options: YAMLTextToSAYParserOptions & { handler?: Partial<YAMLTextToSAYParserAdditionalHandler> } = {},
  ) {
    let parser!: YAMLTextToSAYParser;
    super({
      start: (controller) => {
        const handler = toHandler(controller, options.handler ?? {});
        parser = new YAMLTextToSAYParser({ handler, ...options });
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
  controller: TransformStreamDefaultController<SAYEventInterface>,
  additional: Partial<YAMLTextToSAYParserAdditionalHandler>,
): Partial<SAYHandler & YAMLTextToSAYParserAdditionalHandler> {
  const enqueue = (event: SAYEventInterface) => controller.enqueue(event);
  return {
    ...additional,
    onStartDocument: enqueue,
    onEndDocument: enqueue,
    onComment: enqueue,
    onStartMapping: enqueue,
    onEndMapping: enqueue,
    onStartSequence: enqueue,
    onEndSequence: enqueue,
    onKey: enqueue,
    onScalar: enqueue,
    onAlias: enqueue,
    onError: (err: unknown) => controller.error(err),
  };
}
