import { describe, expect, expectTypeOf, it } from "vitest";
import { ResponseStreamError } from "@simple-api-stream/core";
import { parseJSONResponse } from "./index.js";

describe("parseJSONResponse", () => {
  it("parses standard JSON, +json, NDJSON, and json-seq Responses", async () => {
    const res = new Response(JSON.stringify({ id: 1, name: "Alice" }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    const stream = parseJSONResponse<{ id: number, name: string }>(res);
    expectTypeOf(stream).toEqualTypeOf<ReadableStream<{ id: number, name: string }>>();
    expect(await Array.fromAsync(stream)).toEqual([{ id: 1, name: "Alice" }]);

    // +json suffix
    const problemRes = new Response(JSON.stringify({ title: "Oops" }), {
      status: 400,
      headers: { "content-type": "application/problem+json" },
    });
    expect(await Array.fromAsync(parseJSONResponse(problemRes))).toEqual([{ title: "Oops" }]);

    // NDJSON / nd-json / jsonl auto-detect multiple: true
    const ndjsonRes = new Response("{\"a\":1}\n{\"a\":2}\n", {
      headers: { "content-type": "application/nd-json" },
    });
    expect(await Array.fromAsync(parseJSONResponse(ndjsonRes))).toEqual([{ a: 1 }, { a: 2 }]);

    // +json-seq (e.g. RFC 8142 GeoJSON text sequences) auto-detects multiple: "json-seq"
    const seqRes = new Response("\x1E{\"k\":1}\n\x1E{\"k\":2}\n", {
      headers: { "content-type": "application/geo+json-seq" },
    });
    expect(await Array.fromAsync(parseJSONResponse(seqRes))).toEqual([{ k: 1 }, { k: 2 }]);

    // Explicit parser.multiple overrides Content-Type auto-detection (both enabling and forcing single-doc)
    const multiJsonRes = new Response("{\"x\":1}{\"x\":2}", {
      headers: { "content-type": "application/json" },
    });
    expect(await Array.fromAsync(parseJSONResponse(multiJsonRes, { parser: { multiple: true } }))).toEqual([{ x: 1 }, { x: 2 }]);

    const forcedSingleRes = new Response("{\"a\":1}\n{\"a\":2}\n", {
      headers: { "content-type": "application/x-ndjson" },
    });
    await expect(
      Array.fromAsync(parseJSONResponse(forcedSingleRes, { parser: { multiple: false } })),
    ).rejects.toThrow();
  });

  it("rejects non-JSON Content-Type by default and allows disabling checkContentType", async () => {
    expect(() => parseJSONResponse(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    )).toThrow(ResponseStreamError);
    expect(() => parseJSONResponse(new Response(new Uint8Array()))).toThrow(ResponseStreamError);

    const res = new Response("{\"ok\":true}", { headers: { "content-type": "text/plain" } });
    expect(await Array.fromAsync(parseJSONResponse(res, { checkContentType: false }))).toEqual([{ ok: true }]);
  });
});
