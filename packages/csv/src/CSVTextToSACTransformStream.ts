import type { SACEventInterface } from "./event-interface/index.js";
import type { SACHandler } from "./interface/index.js";
import type { CSVTextToSACParserAdditionalHandler, CSVTextToSACParserOptions } from "./CSVTextToSACParser.js";
import { CSVTextToSACParser } from "./CSVTextToSACParser.js";

/**
 * A `TransformStream` that parses incoming CSV text chunks into SAC event objects.
 */
export class CSVTextToSACTransformStream extends TransformStream<string, SACEventInterface> {
  #parser: CSVTextToSACParser;

  constructor(options: CSVTextToSACParserOptions & Partial<CSVTextToSACParserAdditionalHandler> = {}) {
    const {
      onParseBefore,
      onParseLoopBefore,
      onParseLoopAfter,
      onParseAfter,
      ...parserOptions
    } = options;
    let parser!: CSVTextToSACParser;
    super({
      start(controller) {
        const handler = toHandler(controller, {
          onParseBefore,
          onParseLoopBefore,
          onParseLoopAfter,
          onParseAfter,
        });
        parser = new CSVTextToSACParser({ handler, ...parserOptions });
      },
      transform(chunk) {
        parser.enqueue(chunk);
      },
      flush() {
        parser.flush();
      },
    });
    this.#parser = parser;
  }

  get status() {
    return this.#parser.status;
  }
}

function toHandler(
  controller: TransformStreamDefaultController<SACEventInterface>,
  additional: Partial<CSVTextToSACParserAdditionalHandler>,
): Partial<SACHandler & CSVTextToSACParserAdditionalHandler> {
  const enqueue = (event: SACEventInterface) => controller.enqueue(event);
  return {
    ...additional,
    onStartDocument: enqueue,
    onEndDocument: enqueue,
    onStartHeaderRow: enqueue,
    onEndHeaderRow: enqueue,
    onStartRecordRow: enqueue,
    onEndRecordRow: enqueue,
    onColumn: enqueue,
    onError: (err: unknown) => {
      controller.error(err);
      throw err;
    },
  };
}
