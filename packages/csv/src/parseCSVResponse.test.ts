import { describe, expect, expectTypeOf, it } from "vitest";
import { ResponseStreamError } from "@simple-api-stream/core";
import { parseCSVResponse } from "./index.js";

describe("parseCSVResponse", () => {
  it("parses CSV and TSV Responses and infers mapRow output type", async () => {
    const res = new Response("id,name\n1,Alice\n2,Bob\n", {
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
    const rows = parseCSVResponse(res, {
      parser: { header: true },
      object: {
        mapRow: ({ columns }) => ({ id: Number(columns[0]?.value), name: columns[1]?.value ?? "" }),
      },
    });
    expectTypeOf(rows).toEqualTypeOf<ReadableStream<{ id: number, name: string }>>();
    expect(await Array.fromAsync(rows)).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);

    // TSV auto-sets delimiter: "\t"
    const tsvRes = new Response("a\tb\n1\t2\n", {
      headers: { "content-type": "text/tab-separated-values" },
    });
    expect(await Array.fromAsync(parseCSVResponse(tsvRes, { parser: { header: true } }))).toEqual([
      { a: "1", b: "2" },
    ]);
  });

  it("rejects non-CSV Content-Type by default and allows disabling checkContentType", async () => {
    expect(() => parseCSVResponse(new Response("{}", { headers: { "content-type": "application/json" } }))).toThrow(ResponseStreamError);
    expect(() => parseCSVResponse(new Response(new Uint8Array()))).toThrow(ResponseStreamError);

    const res = new Response("a,b\n1,2\n", { headers: { "content-type": "text/plain" } });
    expect(await Array.fromAsync(parseCSVResponse(res, { checkContentType: false, parser: { header: true } }))).toEqual([
      { a: "1", b: "2" },
    ]);
  });
});
