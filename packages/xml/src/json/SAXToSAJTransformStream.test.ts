import { describe, expect, it } from "vitest";
import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";
import { SAXToObjectTransformStream, XMLTextToSAXTransformStream } from "../index.js";
import { SAXToSAJTransformStream, SAXToSAJTransformStreamError } from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAXToSAJTransformStream (@simple-api-stream/xml/json)", () => {
  it("streams SAX events into SAJ JSON matching SAXToObjectTransformStream output", async () => {
    const xml = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<?xml-stylesheet type=\"text/xsl\" href=\"style.xsl\"?>",
      "<?custom data?>",
      "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0//EN\" \"http://example.com/dtd\">",
      "<!-- comment -->",
      "<root id=\"1\">Hello <b>world</b><![CDATA[<raw>]]><br/></root>",
    ].join("");

    const jsonText = (await Array.fromAsync(
      fromIterable([xml])
        .pipeThrough(new XMLTextToSAXTransformStream())
        .pipeThrough(new SAXToSAJTransformStream())
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    )).join("");

    const [expectedAst] = await Array.fromAsync(
      fromIterable([xml])
        .pipeThrough(new XMLTextToSAXTransformStream())
        .pipeThrough(new SAXToObjectTransformStream()),
    );

    expect(JSON.parse(jsonText)).toEqual(expectedAst);
  });

  it("handles doctype variants, skipDocument, ignore options, makeDocument: false, and empty stream", async () => {
    const transformer = new SAXToSAJTransformStream({
      makeDocument: false,
      ignoreWhitespaceText: true,
      ignoreComments: true,
    });

    const jsonText = (await Array.fromAsync(
      fromIterable([
        { name: "doctype" as const, root: "a", dtdType: "PUBLIC" as const, identifier: "id" },
        { name: "doctype" as const, root: "b", dtdType: "SYSTEM" as const, uri: "b.dtd", declarations: ["<!ELEMENT b EMPTY>"] },
        { name: "doctype" as const, root: "c" },
        { name: "comment" as const, comment: "ignored" },
        { name: "startElement" as const, tagName: "root" },
        { name: "text" as const, text: "   \n  " },
        { name: "text" as const, text: "kept" },
        { name: "endElement" as const, tagName: "root" },
      ])
        .pipeThrough(transformer)
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "normal" })),
    )).join("");

    expect(JSON.parse(jsonText)).toEqual({
      type: "document",
      children: [
        { type: "doctype", root: "a", dtdType: "PUBLIC", identifier: "id" },
        { type: "doctype", root: "b", dtdType: "SYSTEM", uri: "b.dtd", declarations: ["<!ELEMENT b EMPTY>"] },
        { type: "doctype", root: "c" },
        { type: "element", tagName: "root", attrs: {}, children: [{ type: "text", text: "kept" }] },
      ],
    });
    expect(transformer.status).toEqual({ inDocument: false, openTags: [] });

    expect(await Array.fromAsync(fromIterable([]).pipeThrough(new SAXToSAJTransformStream()))).toEqual([]);
  });

  it("errors on invalid SAX event sequences", async () => {
    const runEvents = async (events: unknown[]) => {
      await Array.fromAsync(
        fromIterable(events).pipeThrough(new SAXToSAJTransformStream() as TransformStream<unknown, unknown>),
      );
    };

    await expect(runEvents([{ name: "startDocument", kind: "xml" }, { name: "startDocument", kind: "xml" }])).rejects.toThrow(SAXToSAJTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }, { name: "startDocument", kind: "xml" }])).rejects.toThrow(SAXToSAJTransformStreamError);
    await expect(runEvents([{ name: "endDocument" }])).rejects.toThrow(SAXToSAJTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "xml" }, { name: "startElement", tagName: "a" }, { name: "endDocument" }])).rejects.toThrow(SAXToSAJTransformStreamError);
    await expect(runEvents([{ name: "endElement", tagName: "a" }])).rejects.toThrow(SAXToSAJTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }, { name: "endElement", tagName: "b" }])).rejects.toThrow(SAXToSAJTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }])).rejects.toThrow(SAXToSAJTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "xml" }])).rejects.toThrow(SAXToSAJTransformStreamError);
    await expect(runEvents([{ name: "unknown" }])).rejects.toThrow(SAXToSAJTransformStreamError);
  });
});
