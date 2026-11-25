import type { eventInterfaces } from "@simple-api-stream/json";
import type { SATEventInterface } from "../event-interface/index.js";
import { SATToObjectTransformStream } from "../SATToObjectTransformStream.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

function* emitValueAsSAJ(value: unknown): Generator<SAJEventInterface> {
  if (value === null) {
    yield { name: "value", type: "null", value: null };
    return;
  }
  if (typeof value === "boolean") {
    yield { name: "value", type: "boolean", value };
    return;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      yield { name: "value", type: "number", value };
    }
    else {
      yield { name: "value", type: "null", value: null };
    }
    return;
  }
  if (typeof value === "string") {
    yield { name: "value", type: "string", value };
    return;
  }
  if (Array.isArray(value)) {
    yield { name: "startArray" };
    for (const item of value) {
      yield* emitValueAsSAJ(item);
    }
    yield { name: "endArray" };
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
 * Configuration options for `SATToSAJTransformStream`.
 */
export type SATToSAJTransformStreamOptions = {
  /** Wrap each emitted JSON document in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
};

/**
 * A `TransformStream` that converts SAT (Simple API for TOML) events into SAJ (Simple API for JSON) events.
 */
export class SATToSAJTransformStream extends TransformStream<SATEventInterface, SAJEventInterface> {
  constructor(options?: SATToSAJTransformStreamOptions) {
    const makeDocument = options?.makeDocument ?? true;
    const reconstructor = new SATToObjectTransformStream<Record<string, unknown>>();
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
