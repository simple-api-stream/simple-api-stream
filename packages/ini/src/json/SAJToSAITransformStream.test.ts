import { JSONTextToSAJTransformStream } from "@simple-api-stream/json";
import { describe, expect, it } from "vitest";
import { SAIToINITextTransformStream } from "../index.js";
import { SAJToSAITransformStream } from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAJToSAITransformStream", () => {
  it("converts JSON text to INI text via SAJ -> SAI", async () => {
    const json = JSON.stringify({
      title: "App",
      server: {
        host: "localhost",
        port: 8080,
      },
    });

    const ini = (await Array.fromAsync(
      from([json])
        .pipeThrough(new JSONTextToSAJTransformStream())
        .pipeThrough(new SAJToSAITransformStream())
        .pipeThrough(new SAIToINITextTransformStream({ summarize: true })),
    )).join("");

    expect(ini).toBe("title=App\n[server]\nhost=localhost\nport=8080\n");
  });
});
