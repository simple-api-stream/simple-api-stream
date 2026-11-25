import { describe, expect, it } from "vitest";
import { JSONTextToSAJTransformStream, SAJToJSONTextTransformStream } from "@simple-api-stream/json";
import { SAXToXMLTextTransformStream, XMLTextToSAXTransformStream } from "../index.js";
import { SAJToSAXTransformStream, SAXToSAJTransformStream } from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAJToSAXTransformStream (@simple-api-stream/xml/json)", () => {
  it("round-trips XML text -> SAX -> SAJ -> JSON text -> SAJ -> SAX -> XML text", async () => {
    const xml = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<?xml-stylesheet type=\"text/xsl\" href=\"style.xsl\"?>",
      "<?custom data?>",
      "<!DOCTYPE root PUBLIC \"-//EX//DTD\" \"http://example.com/a.dtd\">",
      "<!-- comment -->",
      "<root id=\"1\">Hello <b>world</b><![CDATA[<raw>]]><br/></root>",
    ].join("");

    const expected = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>",
      "<?xml-stylesheet type=\"text/xsl\" href=\"style.xsl\" ?>",
      "<?custom data ?>",
      "<!DOCTYPE root PUBLIC \"-//EX//DTD\" \"http://example.com/a.dtd\">",
      "<!-- comment -->",
      "<root id=\"1\">Hello <b>world</b><![CDATA[<raw>]]><br/></root>",
    ].join("");

    const jsonText = (await Array.fromAsync(
      fromIterable([xml])
        .pipeThrough(new XMLTextToSAXTransformStream())
        .pipeThrough(new SAXToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    )).join("");

    const roundTrippedXml = (await Array.fromAsync(
      fromIterable([jsonText])
        .pipeThrough(new JSONTextToSAJTransformStream())
        .pipeThrough(new SAJToSAXTransformStream())
        .pipeThrough(new SAXToXMLTextTransformStream({ summarize: "document" })),
    )).join("");

    expect(roundTrippedXml).toBe(expected);
  });

  it("supports multiple JSON documents and arbitrary key order", async () => {
    const ndjson = [
      JSON.stringify({ children: [{ text: "hi", type: "text" }], attrs: {}, tagName: "a", type: "element" }),
      JSON.stringify({ type: "element", tagName: "b", attrs: {}, children: [], selfClosing: true }),
    ].join("\n");

    const xml = (await Array.fromAsync(
      fromIterable([ndjson])
        .pipeThrough(new JSONTextToSAJTransformStream({ multiple: true }))
        .pipeThrough(new SAJToSAXTransformStream({ multiple: true, makeDocument: false }))
        .pipeThrough(new SAXToXMLTextTransformStream({ summarize: "element" })),
    )).join("");

    expect(xml).toBe("<a>hi</a><b/>");

    await expect(
      Array.fromAsync(
        fromIterable(["123"])
          .pipeThrough(new JSONTextToSAJTransformStream())
          .pipeThrough(new SAJToSAXTransformStream()),
      ),
    ).rejects.toThrow();
  });
});
