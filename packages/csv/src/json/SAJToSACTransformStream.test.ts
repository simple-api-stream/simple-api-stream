import { describe, expect, it } from "vitest";
import { JSONTextToSAJTransformStream, SAJToJSONTextTransformStream } from "@simple-api-stream/json";
import { CSVTextToSACTransformStream, SACToCSVTextTransformStream } from "../index.js";
import { SACToSAJTransformStream, SAJToSACTransformStream } from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAJToSACTransformStream (@simple-api-stream/csv/json)", () => {
  it("round-trips headered CSV -> SAJ -> JSON -> SAJ -> SAC -> CSV", async () => {
    const csv = "id,name,note\r\n1,Alice,\"a, b\"\r\n2,Bob,\r\n";

    const jsonText = (await Array.fromAsync(
      fromIterable([csv])
        .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
        .pipeThrough(new SACToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    )).join("");

    const outCsv = (await Array.fromAsync(
      fromIterable([jsonText])
        .pipeThrough(new JSONTextToSAJTransformStream())
        .pipeThrough(new SAJToSACTransformStream())
        .pipeThrough(new SACToCSVTextTransformStream({ summarize: "document" })),
    )).join("");

    expect(outCsv).toBe(csv);
  });

  it("round-trips headerless CSV (array of arrays) without headers", async () => {
    const csv = "1,Alice\r\n2,Bob\r\n";

    const jsonText = (await Array.fromAsync(
      fromIterable([csv])
        .pipeThrough(new CSVTextToSACTransformStream())
        .pipeThrough(new SACToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    )).join("");

    const outCsv = (await Array.fromAsync(
      fromIterable([jsonText])
        .pipeThrough(new JSONTextToSAJTransformStream())
        .pipeThrough(new SAJToSACTransformStream())
        .pipeThrough(new SACToCSVTextTransformStream({ summarize: "document" })),
    )).join("");

    expect(outCsv).toBe(csv);
  });

  it("supports NDJSON, comments, explicit headers, empty JSON array, and errors on invalid row values", async () => {
    const ndjson = "// comment\n{\"b\":2,\"a\":1}\n{\"a\":3,\"b\":4}\n";
    const csv = (await Array.fromAsync(
      fromIterable([ndjson])
        .pipeThrough(new JSONTextToSAJTransformStream({ multiple: true, allowComments: true }))
        .pipeThrough(new SAJToSACTransformStream({ header: ["a", "b"] }))
        .pipeThrough(new SACToCSVTextTransformStream({ lineBreak: "\n", summarize: "document" })),
    )).join("");

    expect(csv).toBe("a,b\n1,2\n3,4\n");

    // Empty JSON array with auto header emits nothing
    const emptyEvents = await Array.fromAsync(
      fromIterable(["[]"])
        .pipeThrough(new JSONTextToSAJTransformStream())
        .pipeThrough(new SAJToSACTransformStream()),
    );
    expect(emptyEvents).toEqual([]);

    // Primitive row errors
    await expect(
      Array.fromAsync(
        fromIterable(["[123]"])
          .pipeThrough(new JSONTextToSAJTransformStream())
          .pipeThrough(new SAJToSACTransformStream()),
      ),
    ).rejects.toThrow();
  });
});
