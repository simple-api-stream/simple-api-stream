import { describe, expect, test } from "vitest";
import { JSONTextToSAJTransformStream } from "@simple-api-stream/json";
import { SATToObjectTransformStream, SATToTOMLTextTransformStream, TOMLTextToSATTransformStream } from "../index.js";
import { SAJToSATTransformStream } from "./index.js";

describe("SAJToSATTransformStream (@simple-api-stream/toml/json)", () => {
  test("pipes JSON text through SAJ -> SAT -> TOML text", async () => {
    const json = JSON.stringify({
      title: "JSON to TOML",
      flag: true,
      count: 42,
      ignored: null,
      server: {
        host: "localhost",
        port: 8080,
      },
      tags: [
        { name: "alpha" },
        { name: "beta" },
      ],
    });

    const readable = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(json);
        controller.close();
      },
    });

    const tomlChunks = await Array.fromAsync(
      readable
        .pipeThrough(new JSONTextToSAJTransformStream())
        .pipeThrough(new SAJToSATTransformStream())
        .pipeThrough(new SATToTOMLTextTransformStream({ summarize: "document" })),
    );

    const [reparsed] = await Array.fromAsync(
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue(tomlChunks.join(""));
          controller.close();
        },
      })
        .pipeThrough(new TOMLTextToSATTransformStream())
        .pipeThrough(new SATToObjectTransformStream()),
    );

    expect(reparsed).toEqual({
      title: "JSON to TOML",
      flag: true,
      count: 42,
      server: {
        host: "localhost",
        port: 8080,
      },
      tags: [
        { name: "alpha" },
        { name: "beta" },
      ],
    });
  });

  test("supports multiple documents and ObjectToSAT options", async () => {
    const ndjson = "{\"a\":1}\n{\"b\":2}\n";
    const readable = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(ndjson);
        controller.close();
      },
    });

    const docs = await Array.fromAsync(
      readable
        .pipeThrough(new JSONTextToSAJTransformStream({ multiple: true }))
        .pipeThrough(new SAJToSATTransformStream({ multiple: true }))
        .pipeThrough(new SATToObjectTransformStream()),
    );

    expect(docs).toEqual([{ a: 1 }, { b: 2 }]);

    // Rejects unsupported null when unSupported: "error"
    await expect(
      Array.fromAsync(
        new ReadableStream<string>({
          start(controller) {
            controller.enqueue("{\"a\":null}");
            controller.close();
          },
        })
          .pipeThrough(new JSONTextToSAJTransformStream())
          .pipeThrough(new SAJToSATTransformStream({ unSupported: "error" })),
      ),
    ).rejects.toThrow();
  });
});
