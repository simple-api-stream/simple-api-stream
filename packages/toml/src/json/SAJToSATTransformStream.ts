import { SAJToObjectTransformStream, type eventInterfaces } from "@simple-api-stream/json";
import type { SATEventInterface } from "../event-interface/index.js";
import { ObjectToSATTransformStream, type ObjectToSATTransformStreamOptions } from "../ObjectToSATTransformStream.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

/**
 * Configuration options for `SAJToSATTransformStream`.
 */
export type SAJToSATTransformStreamOptions = ObjectToSATTransformStreamOptions & {
  /** Accept multiple top-level JSON documents in one stream (default: `false`). */
  multiple?: boolean
};

/**
 * A `TransformStream` that converts SAJ (Simple API for JSON) events into SAT (Simple API for TOML) events.
 */
export class SAJToSATTransformStream extends TransformStream<SAJEventInterface, SATEventInterface> {
  constructor(options?: SAJToSATTransformStreamOptions) {
    const { multiple = false, ...satOptions } = options ?? {};
    const sajToObj = new SAJToObjectTransformStream<unknown>({ multiple });
    const objToSat = new ObjectToSATTransformStream(satOptions);
    const piped = sajToObj.readable.pipeThrough(objToSat);
    const writer = sajToObj.writable.getWriter();
    const reader = piped.getReader();

    let controller_!: TransformStreamDefaultController<SATEventInterface>;
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
