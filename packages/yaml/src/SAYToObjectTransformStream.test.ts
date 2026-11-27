import { describe, expect, it } from "vitest";
import {
  SAYToObjectTransformStream,
  YAMLTextToSAYTransformStream,
  streams,
  type eventInterfaces,
} from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAYToObjectTransformStream", () => {
  it("handles empty documents, documentless streams, __proto__ safety, and multiple: false", async () => {
    const reconstructor = new SAYToObjectTransformStream();
    expect(reconstructor.status).toEqual({ multiple: true, inDocument: false, depth: 0 });

    const docs = await Array.fromAsync(
      from(["---\n...\n---\n__proto__:\n  polluted: true\n"])
        .pipeThrough(new YAMLTextToSAYTransformStream())
        .pipeThrough(reconstructor),
    );
    expect(docs[0]).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(docs[1], "__proto__")).toBe(true);

    // Without startDocument / endDocument -> flushed at end of stream
    const bare = await Array.fromAsync(
      from([{ name: "scalar" as const, type: "number" as const, value: 99 }])
        .pipeThrough(new SAYToObjectTransformStream()),
    );
    expect(bare).toEqual([99]);

    await expect(
      Array.fromAsync(
        from(["---\n1\n---\n2\n"])
          .pipeThrough(new YAMLTextToSAYTransformStream())
          .pipeThrough(new SAYToObjectTransformStream({ multiple: false })),
      ),
    ).rejects.toThrow(streams.SAYToObjectTransformStreamError);
  });

  it("errors on unknown alias or malformed event sequences", async () => {
    await expect(
      Array.fromAsync(
        from(["a: *missing\n"])
          .pipeThrough(new YAMLTextToSAYTransformStream())
          .pipeThrough(new SAYToObjectTransformStream()),
      ),
    ).rejects.toThrow(streams.SAYToObjectTransformStreamError);

    const invalidSequences: eventInterfaces.SAYEventInterface[][] = [
      [{ name: "endDocument" }],
      [{ name: "startDocument", kind: "yaml" }, { name: "startDocument", kind: "yaml" }],
      [{ name: "startDocument", kind: "yaml" }, { name: "startMapping" }, { name: "endDocument" }],
      [{ name: "startMapping" }],
      [{ name: "endMapping" }],
      [{ name: "startMapping" }, { name: "key", key: "a" }, { name: "endMapping" }],
      [{ name: "endSequence" }],
      [{ name: "key", key: "a" }],
      [{ name: "startMapping" }, { name: "key", key: "a" }, { name: "key", key: "b" }],
      [{ name: "startMapping" }, { name: "scalar", type: "number", value: 1 }],
      [{ name: "scalar", type: "number", value: 1 }, { name: "scalar", type: "number", value: 2 }],
    ];

    for (const seq of invalidSequences) {
      await expect(
        Array.fromAsync(from(seq).pipeThrough(new SAYToObjectTransformStream())),
      ).rejects.toThrow(streams.SAYToObjectTransformStreamError);
    }
  });
});
