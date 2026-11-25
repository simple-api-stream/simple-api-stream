import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ObjectToSAXTransformStream,
  SAXToObjectTransformStream,
  SAXToXMLTextTransformStream,
  XMLTextToSAXTransformStream,
  streams,
  type XMLElementNode,
  type XMLNode,
} from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("ObjectToSAXTransformStream", () => {
  it("round-trips XML text -> SAX -> XMLDocumentNode -> SAX -> XML text", async () => {
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

    const output = (await Array.fromAsync(
      fromIterable([xml])
        .pipeThrough(new XMLTextToSAXTransformStream())
        .pipeThrough(new SAXToObjectTransformStream())
        .pipeThrough(new ObjectToSAXTransformStream())
        .pipeThrough(new SAXToXMLTextTransformStream({ summarize: "document" })),
    )).join("");

    expect(output).toBe(expected);
  });

  it("emits child nodes directly and supports makeDocument: false and doctype variants", async () => {
    const nodes: XMLNode[] = [
      { type: "doctype", root: "a", dtdType: "SYSTEM", uri: "a.dtd", declarations: ["<!ELEMENT a EMPTY>"] },
      { type: "doctype", root: "b" },
      { type: "element", tagName: "x", attrs: { k: "v" }, children: [{ type: "text", text: "hi" }] },
    ];
    const transformer = new ObjectToSAXTransformStream({ makeDocument: false });
    expect(transformer.status).toEqual({ makeDocument: false });

    const events = await Array.fromAsync(fromIterable(nodes).pipeThrough(transformer));
    expect(events).toEqual([
      { name: "doctype", root: "a", dtdType: "SYSTEM", uri: "a.dtd", declarations: ["<!ELEMENT a EMPTY>"] },
      { name: "doctype", root: "b", dtdType: undefined },
      { name: "startElement", tagName: "x", attrs: { k: "v" }, selfClosing: false },
      { name: "text", text: "hi" },
      { name: "endElement", tagName: "x" },
    ]);
  });

  it("supports custom mapNode with inferred input type and skip", async () => {
    type Item = { name: string, hidden?: boolean };
    const transformer = new ObjectToSAXTransformStream({
      mapNode: (item: Item, { skip }) => {
        if (item.hidden) return skip;
        return {
          type: "element",
          tagName: "item",
          attrs: { name: item.name },
          children: [],
          selfClosing: true,
        };
      },
    });
    expectTypeOf(transformer).toEqualTypeOf<ObjectToSAXTransformStream<Item>>();

    const events = await Array.fromAsync(
      fromIterable<Item>([
        { name: "a" },
        { name: "b", hidden: true },
      ]).pipeThrough(transformer),
    );
    expect(events).toEqual([
      { name: "startDocument", kind: "xml" },
      { name: "startElement", tagName: "item", attrs: { name: "a" }, selfClosing: true },
      { name: "endElement", tagName: "item" },
      { name: "endDocument" },
    ]);
  });

  it("errors on circular references, invalid nodes, self-closing with children, and mapper errors", async () => {
    const cyclic: XMLElementNode = { type: "element", tagName: "a", attrs: {}, children: [] };
    cyclic.children.push(cyclic);
    await expect(
      Array.fromAsync(fromIterable([cyclic]).pipeThrough(new ObjectToSAXTransformStream())),
    ).rejects.toThrow(streams.ObjectToSAXTransformStreamError);

    await expect(
      Array.fromAsync(
        fromIterable<XMLNode>([
          { type: "element", tagName: "br", attrs: {}, children: [{ type: "text", text: "nope" }], selfClosing: true },
        ]).pipeThrough(new ObjectToSAXTransformStream()),
      ),
    ).rejects.toThrow(streams.ObjectToSAXTransformStreamError);

    await expect(
      Array.fromAsync(
        fromIterable([null]).pipeThrough(new ObjectToSAXTransformStream() as TransformStream<unknown, unknown>),
      ),
    ).rejects.toThrow(streams.ObjectToSAXTransformStreamError);

    await expect(
      Array.fromAsync(
        fromIterable([{ type: "unknown" }]).pipeThrough(new ObjectToSAXTransformStream() as TransformStream<unknown, unknown>),
      ),
    ).rejects.toThrow(streams.ObjectToSAXTransformStreamError);

    await expect(
      Array.fromAsync(
        fromIterable([1]).pipeThrough(new ObjectToSAXTransformStream({
          mapNode: () => {
            throw new Error("boom");
          },
        })),
      ),
    ).rejects.toThrow(streams.ObjectToSAXTransformStreamError);
  });
});
