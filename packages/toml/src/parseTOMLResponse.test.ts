import { describe, expect, expectTypeOf, it } from "vitest";
import { ResponseStreamError } from "@simple-api-stream/core";
import { parseTOMLResponse } from "./index.js";

describe("parseTOMLResponse", () => {
  it("parses TOML Responses", async () => {
    const res = new Response("title = \"Demo\"\n[db]\nport = 5432\n", {
      headers: { "content-type": "application/toml; charset=utf-8" },
    });
    const stream = parseTOMLResponse<{ title: string, db: { port: number } }>(res);
    expectTypeOf(stream).toEqualTypeOf<ReadableStream<{ title: string, db: { port: number } }>>();
    expect(await Array.fromAsync(stream)).toEqual([{ title: "Demo", db: { port: 5432 } }]);
  });

  it("rejects non-TOML Content-Type by default and allows disabling checkContentType", async () => {
    expect(() => parseTOMLResponse(new Response("{}", { headers: { "content-type": "application/json" } }))).toThrow(ResponseStreamError);
    expect(() => parseTOMLResponse(new Response(new Uint8Array()))).toThrow(ResponseStreamError);

    const res = new Response("a = 1\n", { headers: { "content-type": "text/plain" } });
    expect(await Array.fromAsync(parseTOMLResponse(res, { checkContentType: false }))).toEqual([{ a: 1 }]);
  });
});
