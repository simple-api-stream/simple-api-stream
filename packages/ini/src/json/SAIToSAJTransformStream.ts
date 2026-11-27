import type { eventInterfaces } from "@simple-api-stream/json";
import type { SAIEventInterface } from "../event-interface/index.js";
import { SAIToObjectTransformStream } from "../SAIToObjectTransformStream.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

function* emitValueAsSAJ(value: unknown): Generator<SAJEventInterface> {
  if (typeof value === "string") {
    yield { name: "value", type: "string", value };
    return;
  }
  yield { name: "startObject" };
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    yield { name: "key", key: k };
    yield* emitValueAsSAJ(v);
  }
  yield { name: "endObject" };
}

/**
 * Configuration options for `SAIToSAJTransformStream`.
 */
export type SAIToSAJTransformStreamOptions = {
  /** Wrap each emitted JSON document in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
};

/**
 * A `TransformStream` that converts SAI (Simple API for INI) events into SAJ (Simple API for JSON) events.
 */
export class SAIToSAJTransformStream extends TransformStream<SAIEventInterface, SAJEventInterface> {
  constructor(options?: SAIToSAJTransformStreamOptions) {
    const makeDocument = options?.makeDocument ?? true;
    const reconstructor = new SAIToObjectTransformStream<Record<string, unknown>>();
    const writer = reconstructor.writable.getWriter();
    const reader = reconstructor.readable.getReader();

    let controller_!: TransformStreamDefaultController<SAJEventInterface>;
    const pump = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (makeDocument) {
          controller_.enqueue({ name: "startDocument", kind: "json" });
        }
        for (const sajEvent of emitValueAsSAJ(value)) {
          controller_.enqueue(sajEvent);
        }
        if (makeDocument) {
          controller_.enqueue({ name: "endDocument" });
        }
      }
    })();

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
