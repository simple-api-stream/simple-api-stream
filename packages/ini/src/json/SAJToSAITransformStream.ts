import { SAJToObjectTransformStream, type eventInterfaces } from "@simple-api-stream/json";
import type { SAIEventInterface } from "../event-interface/index.js";
import { ObjectToSAITransformStream, type ObjectToSAITransformStreamOptions } from "../ObjectToSAITransformStream.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

/**
 * Configuration options for `SAJToSAITransformStream`.
 */
export type SAJToSAITransformStreamOptions = ObjectToSAITransformStreamOptions & {
  /** Accept multiple top-level JSON documents in one stream (default: `false`). */
  multiple?: boolean
};

/**
 * A `TransformStream` that converts SAJ (Simple API for JSON) events into SAI (Simple API for INI) events.
 */
export class SAJToSAITransformStream extends TransformStream<SAJEventInterface, SAIEventInterface> {
  constructor(options?: SAJToSAITransformStreamOptions) {
    const { multiple = false, ...saiOptions } = options ?? {};
    const sajToObj = new SAJToObjectTransformStream<unknown>({ multiple });
    const objToSai = new ObjectToSAITransformStream(saiOptions);
    const piped = sajToObj.readable.pipeThrough(objToSai);
    const writer = sajToObj.writable.getWriter();
    const reader = piped.getReader();

    let controller_!: TransformStreamDefaultController<SAIEventInterface>;
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
