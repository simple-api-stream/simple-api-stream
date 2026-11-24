import { describe, expect, it } from "vitest";
import {
  DOMToSAXTransformStream,
  SAXToDOMTransformStream,
  SAXToXMLTextTransformStream,
  XMLTextToSAXTransformStream,
  streams,
  type DOMAttrLike,
  type DOMDocumentFactoryLike,
  type DOMMutableElementLike,
  type DOMMutableNodeLike,
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

interface MockNode extends DOMNodeLike, DOMMutableNodeLike {
  childNodes: MockNode[]
}

interface MockElement extends MockNode, DOMMutableElementLike {
  tagName: string
  attributes: DOMAttrLike[]
}

function makeMockNode(props: Omit<MockNode, "childNodes" | "appendChild">): MockNode {
  const node: MockNode = {
    ...props,
    childNodes: [],
    appendChild(child: DOMMutableNodeLike) {
      node.childNodes.push(child as MockNode);
      return child;
    },
  };
  return node;
}

function createMockDocumentFactory(): DOMDocumentFactoryLike<MockNode> & MockNode {
  const createElement = (tagName: string): MockElement => {
    const attrs: DOMAttrLike[] = [];
    const el: MockElement = {
      ...makeMockNode({ nodeType: 1, tagName }),
      tagName,
      attributes: attrs,
      setAttribute(name: string, value: string) {
        attrs.push({ name, value });
      },
    };
    return el;
  };

  const makeDoc = (): DOMDocumentFactoryLike<MockNode> & MockNode => {
    const doc: DOMDocumentFactoryLike<MockNode> & MockNode = {
      ...makeMockNode({ nodeType: 9 }),
      createElement,
      createTextNode: (data: string) => makeMockNode({ nodeType: 3, data }),
      createComment: (data: string) => makeMockNode({ nodeType: 8, data }),
      createCDATASection: (data: string) => makeMockNode({ nodeType: 4, data }),
      createProcessingInstruction: (target: string, data: string) => makeMockNode({ nodeType: 7, target, data }),
      createDocumentFragment: () => makeMockNode({ nodeType: 11 }),
      implementation: {
        createDocument: () => makeDoc(),
        createDocumentType: (qualifiedName: string, publicId: string, systemId: string) =>
          makeMockNode({ nodeType: 10, name: qualifiedName, publicId, systemId }),
      },
    };
    return doc;
  };

  return makeDoc();
}

describe("SAXToDOMTransformStream", () => {
  it("constructs DOM Documents and round-trips with DOMToSAXTransformStream", async () => {
    const mockDoc = createMockDocumentFactory();
    const xml = [
      "<?custom data?>",
      "<!DOCTYPE root PUBLIC \"-//EX//DTD\" \"http://example.com/a.dtd\">",
      "<!-- comment -->",
      "<root id=\"1\">Hello <b>world</b><![CDATA[<raw>]]><br/></root>",
    ].join("");

    const expected = [
      "<?custom data ?>",
      "<!DOCTYPE root PUBLIC \"-//EX//DTD\" \"http://example.com/a.dtd\">",
      "<!-- comment -->",
      "<root id=\"1\">Hello <b>world</b><![CDATA[<raw>]]><br/></root>",
    ].join("");

    const output = (await Array.fromAsync(
      fromIterable([xml])
        .pipeThrough(new XMLTextToSAXTransformStream())
        .pipeThrough(new SAXToDOMTransformStream({ document: mockDoc }))
        .pipeThrough(new DOMToSAXTransformStream({ selfClosingEmptyElements: true }))
        .pipeThrough(new SAXToXMLTextTransformStream({ summarize: "document" })),
    )).join("");

    expect(output).toBe(expected);
  });

  it("supports DocumentFragment mode, doctype variants, skipDocument, ignore options, and minimal factory", async () => {
    const mockDoc = createMockDocumentFactory();
    const transformer = new SAXToDOMTransformStream({
      document: mockDoc,
      createDocument: false,
      ignoreWhitespaceText: true,
      ignoreComments: true,
    });

    const [frag] = await Array.fromAsync(
      fromIterable([
        { name: "doctype" as const, root: "pub", dtdType: "PUBLIC" as const, identifier: "id" },
        { name: "doctype" as const, root: "sys", dtdType: "SYSTEM" as const, uri: "sys.dtd" },
        { name: "doctype" as const, root: "simple" },
        { name: "comment" as const, comment: "ignored" },
        { name: "startElement" as const, tagName: "root" },
        { name: "text" as const, text: "   \n  " },
        { name: "text" as const, text: "kept" },
        { name: "endElement" as const, tagName: "root" },
      ]).pipeThrough(transformer),
    );

    expect(frag.nodeType).toBe(11);
    expect(frag.childNodes.map(n => n.nodeType)).toEqual([10, 10, 10, 1]);
    expect(transformer.status).toEqual({ inDocument: false, openTags: [] });

    // Minimal factory without optional methods (createCDATASection/createComment/createProcessingInstruction/implementation)
    // and non-factory returned from implementation.createDocument
    const minimalFactory: DOMDocumentFactoryLike<MockNode> = {
      createElement: (tagName: string) => ({
        ...makeMockNode({ nodeType: 1, tagName }),
        setAttribute() {},
      }),
      createTextNode: (data: string) => makeMockNode({ nodeType: 3, data }),
      createDocumentFragment: () => makeMockNode({ nodeType: 11 }),
      implementation: {
        createDocument: () => makeMockNode({ nodeType: 9 }),
      },
    };

    const [minDoc] = await Array.fromAsync(
      fromIterable([
        { name: "startDocument" as const, kind: "xml" as const },
        { name: "doctype" as const, root: "ignored" },
        { name: "processingInstruction" as const, target: "pi", data: "x" },
        { name: "comment" as const, comment: "c" },
        { name: "cdata" as const, cdata: "fallback-text" },
        { name: "endDocument" as const },
      ]).pipeThrough(new SAXToDOMTransformStream({ document: minimalFactory })),
    );
    expect(minDoc.nodeType).toBe(9);
    expect(minDoc.childNodes).toHaveLength(1);
    expect(minDoc.childNodes[0].nodeType).toBe(3);
    expect(minDoc.childNodes[0].data).toBe("fallback-text");

    // Empty stream emits nothing
    expect(await Array.fromAsync(fromIterable([]).pipeThrough(new SAXToDOMTransformStream({ document: mockDoc })))).toEqual([]);
  });

  it("uses globalThis.document when options.document is omitted and errors when unavailable", async () => {
    const original = (globalThis as { document?: unknown }).document;
    try {
      delete (globalThis as { document?: unknown }).document;
      expect(() => new SAXToDOMTransformStream()).toThrow(streams.SAXToDOMTransformStreamError);

      (globalThis as { document?: unknown }).document = createMockDocumentFactory();
      const [doc] = await Array.fromAsync(
        fromIterable(["<a/>"])
          .pipeThrough(new XMLTextToSAXTransformStream())
          .pipeThrough(new SAXToDOMTransformStream()),
      );
      expect((doc as MockNode).nodeType).toBe(9);
    }
    finally {
      if (original === undefined) {
        delete (globalThis as { document?: unknown }).document;
      }
      else {
        (globalThis as { document?: unknown }).document = original;
      }
    }
  });

  it("errors on invalid SAX event sequences", async () => {
    const mockDoc = createMockDocumentFactory();
    const runEvents = async (events: unknown[]) => {
      await Array.fromAsync(
        fromIterable(events).pipeThrough(new SAXToDOMTransformStream({ document: mockDoc }) as TransformStream<unknown, unknown>),
      );
    };

    await expect(runEvents([{ name: "startDocument", kind: "xml" }, { name: "startDocument", kind: "xml" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }, { name: "startDocument", kind: "xml" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
    await expect(runEvents([{ name: "endDocument" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "xml" }, { name: "startElement", tagName: "a" }, { name: "endDocument" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
    await expect(runEvents([{ name: "endElement", tagName: "a" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }, { name: "endElement", tagName: "b" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
    await expect(runEvents([{ name: "startElement", tagName: "a" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "xml" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
    await expect(runEvents([{ name: "unknown" }])).rejects.toThrow(streams.SAXToDOMTransformStreamError);
  });
});
