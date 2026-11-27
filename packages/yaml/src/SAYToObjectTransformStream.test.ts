import { describe, expect, it } from "vitest";
import {
  SAYToObjectTransformStream,
  YAMLTextToSAYTransformStream,
  streams,
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
  it("handles empty documents, __proto__ safety, and multiple: false", async () => {
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

    await expect(
      Array.fromAsync(
        from([{ name: "endDocument" as const }]).pipeThrough(new SAYToObjectTransformStream()),
      ),
    ).rejects.toThrow(streams.SAYToObjectTransformStreamError);

    await expect(
      Array.fromAsync(
        from([{ name: "startMapping" as const }]).pipeThrough(new SAYToObjectTransformStream()),
      ),
    ).rejects.toThrow(streams.SAYToObjectTransformStreamError);
  });
});
