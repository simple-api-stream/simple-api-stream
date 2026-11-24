import type { SATEventInterface } from "./event-interface/index.js";
import type { SATHandler } from "./interface/index.js";
import type { TOMLTextToSATParserAdditionalHandler, TOMLTextToSATParserOptions } from "./TOMLTextToSATParser.js";
import { TOMLTextToSATParser } from "./TOMLTextToSATParser.js";

/**
 * A `TransformStream` that converts TOML text chunks into a stream of SAT events.
 */
export class TOMLTextToSATTransformStream extends TransformStream<string, SATEventInterface> {
  #parser: TOMLTextToSATParser;

  constructor(
    options: TOMLTextToSATParserOptions & { handler?: Partial<TOMLTextToSATParserAdditionalHandler> } = {},
  ) {
    let parser!: TOMLTextToSATParser;
    super({
      start: (controller) => {
        const handler = toHandler(controller, options.handler ?? {});
        parser = new TOMLTextToSATParser({ handler, ...options });
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
  controller: TransformStreamDefaultController<SATEventInterface>,
  additional: Partial<TOMLTextToSATParserAdditionalHandler>,
): Partial<SATHandler & TOMLTextToSATParserAdditionalHandler> {
  const enqueue = (event: SATEventInterface) => controller.enqueue(event);
  return {
    ...additional,
    onStartDocument: enqueue,
    onEndDocument: enqueue,
    onComment: enqueue,
    onTable: enqueue,
    onArrayTable: enqueue,
    onKey: enqueue,
    onStartInlineTable: enqueue,
    onEndInlineTable: enqueue,
    onStartArray: enqueue,
    onEndArray: enqueue,
    onValue: enqueue,
    onError: (err: unknown) => controller.error(err),
  };
}
