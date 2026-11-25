import { describe, expect, expectTypeOf, it } from "vitest";
import { ResponseStreamError } from "@simple-api-stream/core";
import { parseXMLResponse, type XMLDocumentNode } from "./index.js";

describe("parseXMLResponse", () => {
  it("parses XML and +xml Responses and infers mapDocument output type", async () => {
    const res = new Response("<root>hi</root>", {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
    const stream = parseXMLResponse(res);
    expectTypeOf(stream).toEqualTypeOf<ReadableStream<XMLDocumentNode>>();
    const [doc] = await Array.fromAsync(stream);
    expect(doc).toEqual({
      type: "document",
      children: [{ type: "element", tagName: "root", attrs: {}, children: [{ type: "text", text: "hi" }] }],
    });

    const rssRes = new Response("<rss/>", {
      headers: { "content-type": "application/rss+xml" },
    });
    const tags = parseXMLResponse(rssRes, {
      object: {
        mapDocument: docNode => docNode.children[0]?.type === "element" ? docNode.children[0].tagName : "",
      },
    });
    expectTypeOf(tags).toEqualTypeOf<ReadableStream<string>>();
    expect(await Array.fromAsync(tags)).toEqual(["rss"]);
  });

  it("rejects non-XML Content-Type by default and allows disabling checkContentType", async () => {
    expect(() => parseXMLResponse(new Response("{}", { headers: { "content-type": "application/json" } }))).toThrow(ResponseStreamError);
    expect(() => parseXMLResponse(new Response(new Uint8Array()))).toThrow(ResponseStreamError);

    const res = new Response("<a/>", { headers: { "content-type": "text/plain" } });
    const [doc] = await Array.fromAsync(parseXMLResponse(res, { checkContentType: false }));
    expect(doc.children[0]).toEqual({ type: "element", tagName: "a", attrs: {}, children: [], selfClosing: true });
  });
});
