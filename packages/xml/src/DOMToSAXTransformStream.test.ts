import { describe, expect, it } from "vitest";
import {
  DOMToSAXTransformStream,
  SAXToXMLTextTransformStream,
  streams,
  type DOMNodeLike,
} from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("DOMToSAXTransformStream", () => {
  it("converts DOM-like Document with all standard node types into SAX events", async () => {
    const doc: DOMNodeLike = {
      nodeType: 9,
      childNodes: [
        { nodeType: 7, target: "xml-stylesheet", data: "type=\"text/xsl\" href=\"a.xsl\"" },
        { nodeType: 10, name: "root", publicId: "-//EX//DTD", systemId: "http://example.com/a.dtd" },
        { nodeType: 8, data: " hello " },
        {
          nodeType: 1,
          tagName: "root",
          attributes: [{ name: "id", value: "1" }, { name: "__proto__", value: "safe" }],
          childNodes: [
            { nodeType: 3, data: "text" },
            { nodeType: 4, data: "<cdata>" },
            { nodeType: 1, tagName: "empty", attributes: [], childNodes: [] },
          ],
        },
      ],
    };

    const transformer = new DOMToSAXTransformStream({ selfClosingEmptyElements: true });
    expect(transformer.status).toEqual({ makeDocument: true, selfClosingEmptyElements: true });

    const events = await Array.fromAsync(fromIterable([doc]).pipeThrough(transformer));
    expect(events).toEqual([
      { name: "startDocument", kind: "xml" },
      { name: "processingInstruction", target: "xml-stylesheet", data: "type=\"text/xsl\" href=\"a.xsl\"" },
      { name: "doctype", root: "root", dtdType: "PUBLIC", identifier: "-//EX//DTD", uri: "http://example.com/a.dtd" },
      { name: "comment", comment: " hello " },
      { name: "startElement", tagName: "root", attrs: { id: "1", ["__proto__"]: "safe" }, selfClosing: false },
      { name: "text", text: "text" },
      { name: "cdata", cdata: "<cdata>" },
      { name: "startElement", tagName: "empty", attrs: {}, selfClosing: true },
      { name: "endElement", tagName: "empty" },
      { name: "endElement", tagName: "root" },
      { name: "endDocument" },
    ]);
  });

  it("handles DocumentFragment, fallback properties, doctype variants, and makeDocument: false", async () => {
    const fragment: DOMNodeLike = {
      nodeType: 11,
      childNodes: [
        { nodeType: 10, nodeName: "sys", systemId: "sys.dtd" },
        { nodeType: 10, name: "pub", publicId: "-//PUB//EN", systemId: "" },
        { nodeType: 10, name: "simple" },
        { nodeType: 7, nodeName: "pi", nodeValue: "val" },
        { nodeType: 7, target: "pi2" },
        { nodeType: 3, nodeValue: "t1" },
        { nodeType: 3 },
        { nodeType: 4, nodeValue: "c1" },
        { nodeType: 4 },
        { nodeType: 8, nodeValue: "m1" },
        { nodeType: 8 },
        { nodeType: 1, nodeName: "bare" },
        { nodeType: 11 },
      ],
    };

    const events = await Array.fromAsync(
      fromIterable([fragment]).pipeThrough(new DOMToSAXTransformStream({ makeDocument: false })),
    );
    expect(events).toEqual([
      { name: "doctype", root: "sys", dtdType: "SYSTEM", uri: "sys.dtd" },
      { name: "doctype", root: "pub", dtdType: "PUBLIC", identifier: "-//PUB//EN", uri: undefined },
      { name: "doctype", root: "simple", dtdType: undefined },
      { name: "processingInstruction", target: "pi", data: "val" },
      { name: "processingInstruction", target: "pi2", data: "" },
      { name: "text", text: "t1" },
      { name: "text", text: "" },
      { name: "cdata", cdata: "c1" },
      { name: "cdata", cdata: "" },
      { name: "comment", comment: "m1" },
      { name: "comment", comment: "" },
      { name: "startElement", tagName: "bare", attrs: {}, selfClosing: false },
      { name: "endElement", tagName: "bare" },
    ]);

    // Pipe directly to XML text
    const xml = (await Array.fromAsync(
      fromIterable<DOMNodeLike>([{
        nodeType: 1,
        tagName: "a",
        attributes: [{ name: "href", value: "https://example.com" }],
        childNodes: [{ nodeType: 3, data: "Go" }],
      }])
        .pipeThrough(new DOMToSAXTransformStream())
        .pipeThrough(new SAXToXMLTextTransformStream({ summarize: "document" })),
    )).join("");
    expect(xml).toBe("<a href=\"https://example.com\">Go</a>");
  });

  it("errors on invalid nodes, missing required fields, unsupported nodeType, and circular references", async () => {
    const run = async (node: unknown) => {
      await Array.fromAsync(
        fromIterable([node]).pipeThrough(new DOMToSAXTransformStream() as TransformStream<unknown, unknown>),
      );
    };

    await expect(run(null)).rejects.toThrow(streams.DOMToSAXTransformStreamError);
    await expect(run({ nodeType: 1 })).rejects.toThrow(streams.DOMToSAXTransformStreamError);
    await expect(run({ nodeType: 7 })).rejects.toThrow(streams.DOMToSAXTransformStreamError);
    await expect(run({ nodeType: 10 })).rejects.toThrow(streams.DOMToSAXTransformStreamError);
    await expect(run({ nodeType: 99 })).rejects.toThrow(streams.DOMToSAXTransformStreamError);

    const cyclic: { nodeType: number, tagName: string, childNodes: DOMNodeLike[] } = {
      nodeType: 1,
      tagName: "loop",
      childNodes: [],
    };
    cyclic.childNodes.push(cyclic);
    await expect(run(cyclic)).rejects.toThrow(streams.DOMToSAXTransformStreamError);
  });
});
