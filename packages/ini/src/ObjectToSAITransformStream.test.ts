import { describe, expect, it } from "vitest";
import {
  ObjectToSAITransformStream,
  SAIToINITextTransformStream,
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

describe("ObjectToSAITransformStream", () => {
  it("converts plain objects with root entries and nested sections", async () => {
    const input = {
      title: "Demo",
      port: 8080,
      enabled: true,
      db: {
        host: "localhost",
        pool: {
          max: 10,
        },
      },
    };

    const text = (await Array.fromAsync(
      from([input])
        .pipeThrough(new ObjectToSAITransformStream())
        .pipeThrough(new SAIToINITextTransformStream({ summarize: true })),
    )).join("");

    expect(text).toBe([
      "title=Demo",
      "port=8080",
      "enabled=true",
      "[db]",
      "host=localhost",
      "[db.pool]",
      "max=10",
      "",
    ].join("\n"));
  });

  it("handles unsupported values according to unSupported option", async () => {
    const input = { a: "ok", b: [1, 2], c: null };

    const ignored = await Array.fromAsync(
      from([input]).pipeThrough(new ObjectToSAITransformStream({ makeDocument: false })),
    );
    expect(ignored).toEqual([{ name: "entry", key: "a", value: "ok" }]);

    await expect(
      Array.fromAsync(
        from([input]).pipeThrough(new ObjectToSAITransformStream({ unSupported: "error" })),
      ),
    ).rejects.toThrow(streams.ObjectToSAITransformStreamError);

    const custom = await Array.fromAsync(
      from([input]).pipeThrough(new ObjectToSAITransformStream({
        makeDocument: false,
        unSupported: ({ value, skip }) => (Array.isArray(value) ? value.join(",") : skip),
      })),
    );
    expect(custom).toEqual([
      { name: "entry", key: "a", value: "ok" },
      { name: "entry", key: "b", value: "1,2" },
    ]);
  });

  it("rejects non-object roots and circular references", async () => {
    await expect(
      Array.fromAsync(from(["not-an-object"]).pipeThrough(new ObjectToSAITransformStream())),
    ).rejects.toThrow(streams.ObjectToSAITransformStreamError);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(
      Array.fromAsync(from([circular]).pipeThrough(new ObjectToSAITransformStream())),
    ).rejects.toThrow(streams.ObjectToSAITransformStreamError);
  });
});
