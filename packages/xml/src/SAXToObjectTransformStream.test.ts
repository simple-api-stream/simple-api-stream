import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ResolveToSAXReadableStream,
  SAXToObjectTransformStream,
  XMLTextToSAXTransformStream,
  streams,
  type XMLDocumentNode,
} from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAXToObjectTransformStream", () => {
  it("reconstructs XMLDocumentNode with all SAX node types", async () => {
    const xml = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<?xml-stylesheet type=\"text/xsl\" href=\"style.xsl\"?>",
      "<?custom foo=\"bar\"?>",
      "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0//EN\" \"http://example.com/dtd\">",
      "<!-- top comment -->",
      "<root id=\"1\">Hello <b>world</b><![CDATA[<raw>]]><br/></root>",
    ].join("");

    const out = fromIterable([xml])
      .pipeThrough(new XMLTextToSAXTransformStream())
      .pipeThrough(new SAXToObjectTransformStream());

    expectTypeOf(out).toEqualTypeOf<ReadableStream<XMLDocumentNode>>();

    const [doc] = await Array.fromAsync(out);
    expect(doc).toEqual({
      type: "document",
      children: [
        {
          type: "processingInstruction",
          target: "xml",
          data: "version=\"1.0\" encoding=\"UTF-8\"",
          version: "1.0",
          encoding: "UTF-8",
          standalone: "yes",
        },
        {
          type: "processingInstruction",
          target: "xml-stylesheet",
          data: "type=\"text/xsl\" href=\"style.xsl\"",
          contentType: "text/xsl",
          href: "style.xsl",
        },
        {
          type: "processingInstruction",
          target: "custom",
          data: "foo=\"bar\"",
        },
        {
          type: "doctype",
          root: "html",
          dtdType: "PUBLIC",
          identifier: "-//W3C//DTD XHTML 1.0//EN",
          uri: "http://example.com/dtd",
        },
        {
          type: "comment",
          comment: " top comment ",
        },
        {
          type: "element",
          tagName: "root",
          attrs: { id: "1" },
          children: [
            { type: "text", text: "Hello " },
            {
              type: "element",
              tagName: "b",
              attrs: {},
              children: [{ type: "text", text: "world" }],
            },
            { type: "cdata", cdata: "<raw>" },
            {
              type: "element",
              tagName: "br",
              attrs: {},
              children: [],
              selfClosing: true,
            },
          ],
        },
      ],
    });
  });

  it("handles doctype variants (PUBLIC without uri, SYSTEM, simple, declarations)", async () => {
    const out = fromIterable([
      { name: "startDocument" as const, kind: "xml" as const },
      { name: "doctype" as const, root: "a", dtdType: "PUBLIC" as const, identifier: "id", declarations: ["<!ELEMENT a EMPTY>"] },
      { name: "doctype" as const, root: "b", dtdType: "SYSTEM" as const, uri: "b.dtd" },
      { name: "doctype" as const, root: "c", dtdType: "SYSTEM" as const, uri: "c.dtd", declarations: ["<!ELEMENT c EMPTY>"] },
      { name: "doctype" as const, root: "d" },
      { name: "doctype" as const, root: "e", declarations: ["<!ELEMENT e EMPTY>"] },
      { name: "startElement" as const, tagName: "x" },
      { name: "endElement" as const, tagName: "x" },
      { name: "endDocument" as const },
    ]).pipeThrough(new SAXToObjectTransformStream());

    const [doc] = await Array.fromAsync(out);
    expect(doc.children).toEqual([
      { type: "doctype", root: "a", dtdType: "PUBLIC", identifier: "id", declarations: ["<!ELEMENT a EMPTY>"] },
      { type: "doctype", root: "b", dtdType: "SYSTEM", uri: "b.dtd" },
      { type: "doctype", root: "c", dtdType: "SYSTEM", uri: "c.dtd", declarations: ["<!ELEMENT c EMPTY>"] },
      { type: "doctype", root: "d" },
      { type: "doctype", root: "e", declarations: ["<!ELEMENT e EMPTY>"] },
      { type: "element", tagName: "x", attrs: {}, children: [] },
    ]);
  });

  it("supports ignoreWhitespaceText, ignoreComments, skipDocument, and empty stream", async () => {
    const xml = "<root>\n  <!-- ignore me -->\n  <a>hi</a>\n</root>";
    const [doc] = await Array.fromAsync(
      fromIterable([xml])
        .pipeThrough(new XMLTextToSAXTransformStream({ skipDocument: true }))
        .pipeThrough(new SAXToObjectTransformStream({ ignoreWhitespaceText: true, ignoreComments: true })),
    );
    expect(doc).toEqual({
      type: "document",
      children: [
        {
          type: "element",
          tagName: "root",
          attrs: {},
          children: [
            {
              type: "element",
              tagName: "a",
              attrs: {},
              children: [{ type: "text", text: "hi" }],
            },
          ],
        },
      ],
    });

    // Whitespace-only text event is skipped when ignoreWhitespaceText is true
    const [wsDoc] = await Array.fromAsync(
      fromIterable([
        { name: "startElement" as const, tagName: "root" },
        { name: "text" as const, text: "   \n\t  " },
        { name: "text" as const, text: "kept" },
        { name: "endElement" as const, tagName: "root" },
      ]).pipeThrough(new SAXToObjectTransformStream({ ignoreWhitespaceText: true })),
    );
    expect(wsDoc).toEqual({
      type: "document",
      children: [{ type: "element", tagName: "root", attrs: {}, children: [{ type: "text", text: "kept" }] }],
    });

    // Empty stream emits nothing
    const empty = await Array.fromAsync(
      fromIterable([]).pipeThrough(new SAXToObjectTransformStream()),
    );
    expect(empty).toEqual([]);
  });

  it("supports mapDocument with inferred output type and skip", async () => {
    const source = new ResolveToSAXReadableStream();
    const transformer = new SAXToObjectTransformStream({
      mapDocument: (doc, { skip }) => {
        const root = doc.children[0];
        if (!root || root.type !== "element" || root.tagName === "skip") return skip;
        return root.tagName;
      },
    });
    const out = source.pipeThrough(transformer);
    expectTypeOf(out).toEqualTypeOf<ReadableStream<string>>();

    source.startDocument();
    source.startElement("skip");
    source.endElement("skip");
    source.endDocument();

    source.startDocument();
    source.startElement("keep");
    source.endElement("keep");
    source.endDocument();
    source.close();

    expect(await Array.fromAsync(out)).toEqual(["keep"]);
    expect(transformer.status).toEqual({ inDocument: false, openTags: [] });
  });

  it("prevents prototype pollution in element attributes", async () => {
    const [doc] = await Array.fromAsync(
      fromIterable(["<a __proto__=\"bad\" ok=\"1\"/>"])
        .pipeThrough(new XMLTextToSAXTransformStream())
        .pipeThrough(new SAXToObjectTransformStream()),
    );
    const el = doc.children[0];
    expect(el.type).toBe("element");
    if (el.type === "element") {
      expect(Object.hasOwn(el.attrs, "__proto__")).toBe(true);
      expect(el.attrs["__proto__"]).toBe("bad");
      expect(el.attrs.ok).toBe("1");
    }
  });

  it("errors on invalid SAX sequences and mapDocument errors", async () => {
    const runEvents = async (events: unknown[]) => {
      await Array.fromAsync(
        fromIterable(events).pipeThrough(new SAXToObjectTransformStream() as TransformStream<unknown, unknown>),
      );
    };

    await expect(runEvents([{ name: "startDocument", kind: "xml" }, { name: "startDocument", kind: "xml" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }, { name: "startDocument", kind: "xml" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);
    await expect(runEvents([{ name: "endDocument" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "xml" }, { name: "startElement", tagName: "a" }, { name: "endDocument" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);
    await expect(runEvents([{ name: "endElement", tagName: "a" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }, { name: "endElement", tagName: "b" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "xml" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);
    await expect(runEvents([{ name: "unknown" }])).rejects.toThrow(streams.SAXToObjectTransformStreamError);

    await expect(
      Array.fromAsync(
        fromIterable(["<a/>"])
          .pipeThrough(new XMLTextToSAXTransformStream())
          .pipeThrough(new SAXToObjectTransformStream({
            mapDocument: () => {
              throw new Error("map failed");
            },
          })),
      ),
    ).rejects.toThrow(streams.SAXToObjectTransformStreamError);
  });
});
