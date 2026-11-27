import { describe, expect, it } from "vitest";
import {
  INITextToSAITransformStream,
  SAIToObjectTransformStream,
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

describe("SAIToObjectTransformStream", () => {
  it("reconstructs root entries and sections with last-write-wins for duplicates", async () => {
    const ini = [
      "root = first",
      "root = second",
      "[db]",
      "host = db1",
      "port = 5432",
      "[db]",
      "host = db2",
    ].join("\n");

    const objs = await Array.fromAsync(
      from([ini])
        .pipeThrough(new INITextToSAITransformStream())
        .pipeThrough(new SAIToObjectTransformStream()),
    );

    expect(objs).toEqual([
      {
        root: "second",
        db: {
          host: "db2",
          port: "5432",
        },
      },
    ]);
  });

  it("safely handles __proto__ keys without polluting Object.prototype", async () => {
    const ini = "[__proto__]\npolluted = yes\n";
    const [obj] = await Array.fromAsync(
      from([ini])
        .pipeThrough(new INITextToSAITransformStream())
        .pipeThrough(new SAIToObjectTransformStream()),
    );

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(obj, "__proto__")).toBe(true);
  });

  it("handles events without startDocument/endDocument", async () => {
    const objs = await Array.fromAsync(
      from([
        { name: "entry" as const, key: "a", value: "1" },
      ]).pipeThrough(new SAIToObjectTransformStream()),
    );
    expect(objs).toEqual([{ a: "1" }]);
  });

  it("errors on unclosed document or unexpected endDocument", async () => {
    await expect(
      Array.fromAsync(
        from([{ name: "startDocument" as const, kind: "ini" as const }])
          .pipeThrough(new SAIToObjectTransformStream()),
      ),
    ).rejects.toThrow(streams.SAIToObjectTransformStreamError);

    await expect(
      Array.fromAsync(
        from([{ name: "endDocument" as const }])
          .pipeThrough(new SAIToObjectTransformStream()),
      ),
    ).rejects.toThrow(streams.SAIToObjectTransformStreamError);
  });
});
