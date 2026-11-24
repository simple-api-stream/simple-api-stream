import { describe, expect, it } from "vitest";
import {
  ResponseStreamError,
  extractCharset,
  parseMediaType,
  responseToTextStream,
} from "./index.js";

describe("responseToTextStream", () => {
  it("parses media types and extracts charsets", () => {
    expect(parseMediaType(null)).toBeNull();
    expect(parseMediaType("  ; charset=utf-8")).toBeNull();
    expect(parseMediaType("Application/JSON; charset=utf-8")).toBe("application/json");
    expect(parseMediaType("text/csv")).toBe("text/csv");

    expect(extractCharset(null)).toBeUndefined();
    expect(extractCharset("text/plain")).toBeUndefined();
    expect(extractCharset("text/plain; charset=utf-8")).toBe("utf-8");
    expect(extractCharset("text/plain; charset=\"shift_jis\"")).toBe("shift_jis");
    expect(extractCharset("text/plain; charset=\"   \"")).toBeUndefined();
  });

  it("decodes Response body using Content-Type charset or explicit encoding", async () => {
    const res = new Response("hello", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
    const chunks = await Array.fromAsync(responseToTextStream(res));
    expect(chunks.join("")).toBe("hello");

    const resNoHeader = new Response(new TextEncoder().encode("world"));
    const chunks2 = await Array.fromAsync(responseToTextStream(resNoHeader, { encoding: "utf-8" }));
    expect(chunks2.join("")).toBe("world");
    const chunks3 = await Array.fromAsync(responseToTextStream(new Response(new TextEncoder().encode("default"))));
    expect(chunks3.join("")).toBe("default");
  });

  it("validates checkOk, checkContentType (default, RegExp, function, false), and null body", () => {
    const noContentType = () => new Response(new TextEncoder().encode("hi"));

    // checkOk
    expect(() => responseToTextStream(
      new Response("err", { status: 404, statusText: "Not Found" }),
      { checkOk: true },
    )).toThrow(ResponseStreamError);
    expect(() => responseToTextStream(
      new Response("err", { status: 500, statusText: "" }),
      { checkOk: true },
    )).toThrow("Response is not ok: 500");

    // default matcher
    expect(() => responseToTextStream(
      new Response("hi", { headers: { "content-type": "text/html" } }),
      undefined,
      mt => mt === "application/json",
    )).toThrow(ResponseStreamError);
    expect(() => responseToTextStream(
      noContentType(),
      undefined,
      mt => mt === "application/json",
    )).toThrow("Unexpected Content-Type: (missing)");

    // checkContentType: true without default matcher is a no-op
    expect(responseToTextStream(new Response("ok"), { checkContentType: true })).toBeInstanceOf(ReadableStream);

    // checkContentType: false disables default matcher
    expect(responseToTextStream(
      new Response("hi", { headers: { "content-type": "text/html" } }),
      { checkContentType: false },
      mt => mt === "application/json",
    )).toBeInstanceOf(ReadableStream);

    // checkContentType: RegExp
    expect(responseToTextStream(
      new Response("hi", { headers: { "content-type": "application/vnd.api+json" } }),
      { checkContentType: /\+json/ },
    )).toBeInstanceOf(ReadableStream);
    expect(() => responseToTextStream(
      new Response("hi", { headers: { "content-type": "text/plain" } }),
      { checkContentType: /\+json/ },
    )).toThrow(ResponseStreamError);
    expect(() => responseToTextStream(
      noContentType(),
      { checkContentType: /\+json/ },
    )).toThrow("Unexpected Content-Type: (missing)");

    // checkContentType: function
    expect(responseToTextStream(
      new Response("hi", { headers: { "content-type": "custom/type" } }),
      { checkContentType: ct => ct === "custom/type" },
    )).toBeInstanceOf(ReadableStream);
    expect(() => responseToTextStream(
      noContentType(),
      { checkContentType: ct => ct === "custom/type" },
    )).toThrow("Unexpected Content-Type: (missing)");
    expect(() => responseToTextStream(
      new Response("hi", { headers: { "content-type": "other/type" } }),
      { checkContentType: ct => ct === "custom/type" },
    )).toThrow("Unexpected Content-Type: other/type");

    // null body (e.g. 204 No Content)
    const noBody = new Response(null, { status: 204 });
    expect(() => responseToTextStream(noBody)).toThrow("Response body is null");
  });
});
