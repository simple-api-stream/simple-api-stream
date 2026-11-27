import { ResponseStreamError } from "@simple-api-stream/core";
import { describe, expect, it } from "vitest";
import { parseINIResponse } from "./index.js";

describe("parseINIResponse", () => {
  it("parses an INI Response with text/plain or text/x-ini Content-Type", async () => {
    const res = new Response("[app]\nname = demo\n", {
      headers: { "content-type": "text/x-ini; charset=utf-8" },
    });

    const objs = await Array.fromAsync(parseINIResponse(res));
    expect(objs).toEqual([{ app: { name: "demo" } }]);
  });

  it("rejects unexpected or missing Content-Type by default", () => {
    const jsonRes = new Response("[app]\nname = demo\n", {
      headers: { "content-type": "application/json" },
    });
    expect(() => parseINIResponse(jsonRes)).toThrow(ResponseStreamError);

    const noCtRes = new Response(new ReadableStream());
    expect(() => parseINIResponse(noCtRes)).toThrow(ResponseStreamError);
  });
});
