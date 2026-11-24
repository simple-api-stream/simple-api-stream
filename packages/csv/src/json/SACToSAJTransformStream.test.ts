import { describe, expect, it } from "vitest";
import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";
import { CSVTextToSACTransformStream } from "../index.js";
import { SACToSAJTransformStream, SACToSAJTransformStreamError } from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SACToSAJTransformStream (@simple-api-stream/csv/json)", () => {
  it("streams headered CSV into a JSON array of objects by default", async () => {
    const csv = "id,name,note\r\n1,Alice,\"a, b\"\r\n2,Bob,\r\n";
    const jsonText = (await Array.fromAsync(
      fromIterable([csv])
        .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
        .pipeThrough(new SACToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    )).join("");

    expect(JSON.parse(jsonText)).toEqual([
      { id: "1", name: "Alice", note: "a, b" },
      { id: "2", name: "Bob", note: "" },
    ]);
  });

  it("streams headerless CSV into a JSON array of arrays in auto mode", async () => {
    const csv = "1,Alice\n2,Bob\n";
    const jsonText = (await Array.fromAsync(
      fromIterable([csv])
        .pipeThrough(new CSVTextToSACTransformStream())
        .pipeThrough(new SACToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    )).join("");

    expect(JSON.parse(jsonText)).toEqual([
      ["1", "Alice"],
      ["2", "Bob"],
    ]);
  });

  it("supports multiple (NDJSON), rowFormat: object/array, includeHeaderRow, makeDocument: false, and skipDocument", async () => {
    const csv = "id,name\n1,Alice\n2,Bob\n";

    // multiple: true (NDJSON)
    const ndjsonChunks = await Array.fromAsync(
      fromIterable([csv])
        .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
        .pipeThrough(new SACToSAJTransformStream({ multiple: true }))
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    );
    expect(ndjsonChunks.map(c => JSON.parse(c) as unknown)).toEqual([
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);

    // rowFormat: "array" with includeHeaderRow: true and makeDocument: false
    const arrJson = (await Array.fromAsync(
      fromIterable([csv])
        .pipeThrough(new CSVTextToSACTransformStream({ header: true, skipDocument: true }))
        .pipeThrough(new SACToSAJTransformStream({ rowFormat: "array", includeHeaderRow: true, makeDocument: false }))
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "normal" })),
    )).join("");
    expect(JSON.parse(arrJson)).toEqual([
      ["id", "name"],
      ["1", "Alice"],
      ["2", "Bob"],
    ]);

    // rowFormat: "object" without header + empty record row + column without index/header
    const transformer = new SACToSAJTransformStream({ rowFormat: "object", multiple: true, makeDocument: false });
    const objEvents = await Array.fromAsync(
      fromIterable([
        { name: "startRecordRow" as const },
        { name: "column" as const, value: "x" },
        { name: "endRecordRow" as const },
        { name: "startRecordRow" as const },
        { name: "endRecordRow" as const },
      ])
        .pipeThrough(transformer)
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "normal" })),
    );
    expect(objEvents.map(c => JSON.parse(c) as unknown)).toEqual([{ 0: "x" }, {}]);
    expect(transformer.status).toEqual({ inDocument: false, inRow: null, headers: undefined });

    // Column with header fallback from collected headers + empty row with headers + status.headers
    const withHeaders = new SACToSAJTransformStream();
    const res = (await Array.fromAsync(
      fromIterable([
        { name: "startHeaderRow" as const },
        { name: "column" as const, value: "h1" },
        { name: "endHeaderRow" as const },
        { name: "startRecordRow" as const },
        { name: "column" as const, value: "v1" },
        { name: "column" as const, value: "v2", index: 1 },
        { name: "endRecordRow" as const },
        { name: "startRecordRow" as const },
        { name: "endRecordRow" as const },
      ])
        .pipeThrough(withHeaders)
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    )).join("");
    expect(JSON.parse(res)).toEqual([{ h1: "v1", 1: "v2" }, {}]);
    expect(withHeaders.status.headers).toEqual(["h1"]);

    // Column with col.header only (no header row) in auto mode + empty row without header
    const colHeaderOnly = (await Array.fromAsync(
      fromIterable([
        { name: "startRecordRow" as const },
        { name: "column" as const, value: "v", header: "k" },
        { name: "endRecordRow" as const },
        { name: "startRecordRow" as const },
        { name: "endRecordRow" as const },
      ])
        .pipeThrough(new SACToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    )).join("");
    expect(JSON.parse(colHeaderOnly)).toEqual([{ k: "v" }, []]);
  });

  it("errors on invalid SAC event sequences", async () => {
    const runEvents = async (events: unknown[]) => {
      await Array.fromAsync(
        fromIterable(events).pipeThrough(new SACToSAJTransformStream() as TransformStream<unknown, unknown>),
      );
    };

    await expect(runEvents([{ name: "column", value: "x" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }, { name: "startDocument", kind: "csv" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }, { name: "startDocument", kind: "csv" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "endDocument" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }, { name: "startRecordRow" }, { name: "endDocument" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "startHeaderRow" }, { name: "startHeaderRow" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "endHeaderRow" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }, { name: "startRecordRow" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "endRecordRow" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }])).rejects.toThrow(SACToSAJTransformStreamError);
    await expect(runEvents([{ name: "unknown" }])).rejects.toThrow(SACToSAJTransformStreamError);
  });
});
