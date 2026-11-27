import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";
import { describe, expect, it } from "vitest";
import { INITextToSAITransformStream } from "../index.js";
import { SAIToSAJTransformStream } from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAIToSAJTransformStream", () => {
  it("converts INI text to JSON text via SAI -> SAJ", async () => {
    const ini = "global = yes\n[server]\nhost = localhost\nhost = 127.0.0.1\n";
    const jsonText = (await Array.fromAsync(
      from([ini])
        .pipeThrough(new INITextToSAITransformStream())
        .pipeThrough(new SAIToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: true })),
    )).join("");

    expect(JSON.parse(jsonText)).toEqual({
      global: "yes",
      server: {
        host: "127.0.0.1",
      },
    });
  });
});
