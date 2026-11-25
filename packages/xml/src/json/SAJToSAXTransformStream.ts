import { SAJToObjectTransformStream, type eventInterfaces } from "@simple-api-stream/json";
import type { SAXEventInterface } from "../event-interface/index.js";
import type { XMLNode } from "../node.js";
import { ObjectToSAXTransformStream } from "../ObjectToSAXTransformStream.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

/**
 * Configuration options for `SAJToSAXTransformStream`.
 */
export type SAJToSAXTransformStreamOptions = {
  /** Wrap each emitted top-level XML node in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /** Accept multiple top-level JSON documents in one stream (default: `false`). */
  multiple?: boolean
};

/**
 * A `TransformStream` that converts SAJ (Simple API for JSON) events representing `XMLNode` AST structures
 * into SAX (Simple API for XML) events.
 */
export class SAJToSAXTransformStream extends TransformStream<SAJEventInterface, SAXEventInterface> {
  constructor(options?: SAJToSAXTransformStreamOptions) {
    const { multiple = false, makeDocument = true } = options ?? {};
    const sajToObj = new SAJToObjectTransformStream<XMLNode>({ multiple });
    const objToSax = new ObjectToSAXTransformStream<XMLNode>({ makeDocument });
    const piped = sajToObj.readable.pipeThrough(objToSax);
    const writer = sajToObj.writable.getWriter();
    const reader = piped.getReader();

    let controller_!: TransformStreamDefaultController<SAXEventInterface>;
    const pump = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller_.enqueue(value);
      }
    })();
    pump.catch(() => {});

    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: async (chunk) => {
        await writer.write(chunk);
      },
      flush: async () => {
        await writer.close();
        await pump;
      },
    });
  }
}
