import type { eventInterfaces } from "@simple-api-stream/json";
import type { SAYEventInterface } from "../event-interface/index.js";
import { SAYToObjectTransformStream } from "../SAYToObjectTransformStream.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

/**
 * Error thrown by `SAYToSAJTransformStream` when a YAML value (such as a circular anchor reference) cannot be represented in JSON.
 */
export class SAYToSAJTransformStreamError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAYToSAJTransformStreamError";
  }
}

function* emitValueAsSAJ(value: unknown, ancestors: Set<object> = new Set()): Generator<SAJEventInterface> {
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
  const obj = value as object;
  if (ancestors.has(obj)) {
    throw new SAYToSAJTransformStreamError("Circular reference cannot be represented in JSON");
  }
  ancestors.add(obj);
  try {
    if (Array.isArray(value)) {
      yield { name: "startArray" };
      for (const item of value) {
        yield* emitValueAsSAJ(item, ancestors);
      }
      yield { name: "endArray" };
      return;
    }
    yield { name: "startObject" };
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      yield { name: "key", key: k };
      yield* emitValueAsSAJ(v, ancestors);
    }
    yield { name: "endObject" };
  }
  finally {
    ancestors.delete(obj);
  }
}

/**
 * Configuration options for `SAYToSAJTransformStream`.
 */
export type SAYToSAJTransformStreamOptions = {
  /** Wrap each emitted JSON document in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /** Allow multiple YAML documents in one stream (default: `true`). */
  multiple?: boolean
};

/**
 * A `TransformStream` that converts SAY (Simple API for YAML) events into SAJ (Simple API for JSON) events.
 */
export class SAYToSAJTransformStream extends TransformStream<SAYEventInterface, SAJEventInterface> {
  constructor(options?: SAYToSAJTransformStreamOptions) {
    const makeDocument = options?.makeDocument ?? true;
    const multiple = options?.multiple ?? true;
    const reconstructor = new SAYToObjectTransformStream<unknown>({ multiple });
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
