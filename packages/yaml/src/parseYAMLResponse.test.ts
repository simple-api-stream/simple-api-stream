import { ResponseStreamError } from "@simple-api-stream/core";
import { describe, expect, it } from "vitest";
import { parseYAMLResponse } from "./index.js";

describe("parseYAMLResponse", () => {
  it("parses application/yaml and text/yaml Responses", async () => {
    const res = new Response("---\nname: demo\n---\nname: second\n", {
      headers: { "content-type": "application/yaml; charset=utf-8" },
    });
    expect(await Array.fromAsync(parseYAMLResponse(res))).toEqual([
      { name: "demo" },
      { name: "second" },
    ]);
  });

  it("rejects unexpected or missing Content-Type by default", () => {
    expect(() => parseYAMLResponse(new Response("a: 1", { headers: { "content-type": "application/json" } })))
      .toThrow(ResponseStreamError);
    expect(() => parseYAMLResponse(new Response(new ReadableStream())))
      .toThrow(ResponseStreamError);
  });
});
