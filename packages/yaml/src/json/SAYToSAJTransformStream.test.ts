import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";
import { describe, expect, it } from "vitest";
import { YAMLTextToSAYTransformStream } from "../index.js";
import { SAYToSAJTransformStream } from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAYToSAJTransformStream", () => {
  it("converts YAML (including anchors and special floats) to JSON text", async () => {
    const yaml = [
      "base: &b",
      "  ok: true",
      "copy: *b",
      "nums: [1, .inf, null]",
      "name: demo",
    ].join("\n");

    const jsonText = (await Array.fromAsync(
      from([yaml])
        .pipeThrough(new YAMLTextToSAYTransformStream())
        .pipeThrough(new SAYToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: true })),
    )).join("");

    expect(JSON.parse(jsonText)).toEqual({
      base: { ok: true },
      copy: { ok: true },
      nums: [1, null, null],
      name: "demo",
    });
  });

  it("supports makeDocument: false", async () => {
    const events = await Array.fromAsync(
      from(["a: 1\n"])
        .pipeThrough(new YAMLTextToSAYTransformStream())
        .pipeThrough(new SAYToSAJTransformStream({ makeDocument: false })),
    );
    expect(events).toEqual([
      { name: "startObject" },
      { name: "key", key: "a" },
      { name: "value", type: "number", value: 1 },
      { name: "endObject" },
    ]);
  });
});
