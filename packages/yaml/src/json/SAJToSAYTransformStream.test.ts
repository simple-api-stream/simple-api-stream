import { JSONTextToSAJTransformStream } from "@simple-api-stream/json";
import { describe, expect, it } from "vitest";
import { SAYToYAMLTextTransformStream } from "../index.js";
import { SAJToSAYTransformStream } from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAJToSAYTransformStream", () => {
  it("streams JSONC directly to YAML text preserving comments", async () => {
    const jsonc = "// top comment\n{\"name\": \"demo\", \"items\": [1, true, null]}\n";
    const yaml = (await Array.fromAsync(
      from([jsonc])
        .pipeThrough(new JSONTextToSAJTransformStream({ allowComments: true }))
        .pipeThrough(new SAJToSAYTransformStream())
        .pipeThrough(new SAYToYAMLTextTransformStream({ comments: true, summarize: true })),
    )).join("");

    expect(yaml).toBe([
      "# top comment",
      "name: demo",
      "items:",
      "  - 1",
      "  - true",
      "  - null",
      "",
    ].join("\n"));
  });

  it("supports makeDocument: false, comments: false, and error events", async () => {
    const events = await Array.fromAsync(
      from(["// c\n{\"a\": 1}"])
        .pipeThrough(new JSONTextToSAJTransformStream({ allowComments: true }))
        .pipeThrough(new SAJToSAYTransformStream({ makeDocument: false, comments: false })),
    );
    expect(events).toEqual([
      { name: "startMapping" },
      { name: "key", key: "a" },
      { name: "scalar", type: "number", value: 1 },
      { name: "endMapping" },
    ]);

    await expect(
      Array.fromAsync(
        from([{ name: "error" as const, error: new Error("seq error") }])
          .pipeThrough(new SAJToSAYTransformStream()),
      ),
    ).rejects.toThrow("seq error");
  });
});
