import { describe, expect, it } from "vitest";
import {
  ObjectToSAYTransformStream,
  SAYToYAMLTextTransformStream,
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

describe("ObjectToSAYTransformStream", () => {
  it("serializes JS values including Date, arrays, nested objects, and null", async () => {
    const converter = new ObjectToSAYTransformStream();
    expect(converter.status.makeDocument).toBe(true);

    const text = (await Array.fromAsync(
      from([{
        name: "demo",
        count: 3,
        ok: true,
        empty: null,
        at: new Date("2026-01-01T00:00:00.000Z"),
        tags: ["a", "b"],
      }])
        .pipeThrough(converter)
        .pipeThrough(new SAYToYAMLTextTransformStream({ summarize: true })),
    )).join("");

    expect(text).toBe([
      "name: demo",
      "count: 3",
      "ok: true",
      "empty: null",
      "at: \"2026-01-01T00:00:00.000Z\"",
      "tags:",
      "  - a",
      "  - b",
      "",
    ].join("\n"));
  });

  it("handles unSupported modes (ignore, null, error, custom), top-level skip, and circular references", async () => {
    const input = { a: 1, b: undefined, c: new Date("invalid") };

    const ignored = await Array.fromAsync(
      from([input, undefined]).pipeThrough(new ObjectToSAYTransformStream({ makeDocument: false })),
    );
    expect(ignored).toEqual([
      { name: "startMapping" },
      { name: "key", key: "a" },
      { name: "scalar", type: "number", value: 1 },
      { name: "endMapping" },
    ]);

    const nullConverter = new ObjectToSAYTransformStream({ makeDocument: false, unSupported: "null" });
    expect(nullConverter.status.unSupported[0]).toBe("null");
    const nulled = await Array.fromAsync(
      from([{ u: undefined, d: new Date("invalid") }]).pipeThrough(nullConverter),
    );
    expect(nulled).toEqual([
      { name: "startMapping" },
      { name: "key", key: "u" },
      { name: "scalar", type: "null", value: null },
      { name: "key", key: "d" },
      { name: "scalar", type: "null", value: null },
      { name: "endMapping" },
    ]);

    const errConverter = new ObjectToSAYTransformStream({ unSupported: "error" });
    expect(errConverter.status.unSupported[0]).toBe("error");
    await expect(
      Array.fromAsync(from([input]).pipeThrough(errConverter)),
    ).rejects.toThrow(streams.ObjectToSAYTransformStreamError);

    const custom = new ObjectToSAYTransformStream({
      makeDocument: false,
      unSupported: ({ value, skip }) => (typeof value === "bigint" ? Number(value) : skip),
    });
    expect(custom.status.unSupported[0]).toBe("custom");
    const customEvents = await Array.fromAsync(from([{ n: 10n, skipMe: undefined }]).pipeThrough(custom));
    expect(customEvents).toEqual([
      { name: "startMapping" },
      { name: "key", key: "n" },
      { name: "scalar", type: "number", value: 10 },
      { name: "endMapping" },
    ]);

    // Custom handler returning another unsupported value errors
    await expect(
      Array.fromAsync(
        from([{ bad: undefined }]).pipeThrough(new ObjectToSAYTransformStream({
          unSupported: () => undefined,
        })),
      ),
    ).rejects.toThrow(streams.ObjectToSAYTransformStreamError);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(
      Array.fromAsync(from([circular]).pipeThrough(new ObjectToSAYTransformStream())),
    ).rejects.toThrow(streams.ObjectToSAYTransformStreamError);
  });
});
