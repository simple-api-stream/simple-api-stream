import { test, vi, describe, expect } from "vitest";
import { XMLTextToSAXEventWritableStream } from "../index.js";
import * as xml from "./index.js";
import { toErrorMessage } from "../utils/index.js";

function makeStringListHandlerAndArray() {
  const events: string[] = [];
  const handler: xml.interfaces.SAXHandler = {
    onStartElement({ tagName, attrs, selfClosing }) {
      events.push(`start:${tagName}:${JSON.stringify(attrs)}:${selfClosing}`);
    },
    onEndElement({ tagName }) {
      events.push(`end:${tagName}`);
    },
    onText({ text }) {
      events.push(`text:${text}`);
    },
    onError(err) {
      events.push(`error:${toErrorMessage(err).message}`);
    },
    onComment({ comment }) {
      events.push(`comment:${comment}`);
    },
    onCdata({ cdata }) {
      events.push(`cdata:${cdata}`);
    },
    onDoctype({ root, ...args }) {
      if (args.dtdType === "PUBLIC")
        events.push(`doctype:${root}:${args.dtdType}:${args.identifier}:${args.uri ?? ""}:${args.declarations?.join(",") ?? ""}`);
      else if (args.dtdType === "SYSTEM")
        events.push(`doctype:${root}:${args.dtdType}:${args.uri}:${args.declarations?.join(",") ?? ""}`);
      else
        events.push(`doctype:${root}:${args.declarations?.join(",") ?? ""}`);
    },
    onProcessingInstruction({ target, data }) {
      events.push(`processingInstruction:${target}:${data}`);
    },
    onStartDocument() {
      events.push(`startDocument`);
    },
    onEndDocument() {
      events.push(`endDocument`);
    },
  };
  return [handler, events] as const;
}

describe("pattern test", (it) => {
  const entries: {
    name: string
    options?: ConstructorParameters<typeof XMLTextToSAXEventWritableStream>[1]
    input: string
    output: string[]
  }[] = [
    {
      name: "parses start and end tags with attributes",
      options: { skipDocument: true },
      input: "<!DOCTYPE hoge><root \nattr=\"value\">text<!--comment\n--><![CDATA[ \ncdata ]]><child attr2=\"v2\"/></root>",
      output: [
        "doctype:hoge:",
        "start:root:{\"attr\":\"value\"}:false",
        "text:text",
        "comment:comment",
        "cdata: cdata ",
        "start:child:{\"attr2\":\"v2\"}:true",
        "end:child",
        "end:root",
      ],
    },
  ];
  it.each(entries)("$name", async ({ options, input: xml, output }) => {
    const [handler, events] = makeStringListHandlerAndArray();
    const stream = new XMLTextToSAXEventWritableStream(handler, options);
    const writer = stream.getWriter();
    for (const chunk of xml.match(/.{1,10}/g) ?? [])
      await writer.write(chunk);
    await writer.close();

    expect(events).toEqual(output);
  });
});

test("handles malformed XML gracefully", async ({ expect }) => {
  const handler: Partial<xml.interfaces.SAXHandler> = {
    onError: vi.fn(),
  };
  const stream = new XMLTextToSAXEventWritableStream(handler);
  await stream.getWriter().abort(new Error("bad xml"));
  expect(handler.onError).toHaveBeenCalledWith(expect.any(Error));
  expect(stream.status).toEqual({
    acc: "",
    buffer: "",
    openDocumented: false,
    state: "text",
  });
});

test("handles only text nodes", async ({ expect }) => {
  const handler: Partial<xml.interfaces.SAXHandler> = {
    onText: vi.fn(),
  };
  const stream = new XMLTextToSAXEventWritableStream(handler);
  const writer = stream.getWriter();
  await writer.write("   just text   ");
  await writer.close();
  expect(handler.onText).toHaveBeenCalledWith(new xml.events.TextEvent("   just text   "));
});

test("handles missing handlers gracefully", async ({ expect }) => {
  const handler: Partial<xml.interfaces.SAXHandler> = {}; // すべて未定義
  const stream = new XMLTextToSAXEventWritableStream(handler);
  const writer = stream.getWriter();
  await writer.write("<a attr=\"1\"/>SomeText</a>");
  await writer.close();
  expect(true).toBe(true); // エラーが出なければOK
});

test("handles malformed attributes and catches errors", async ({ expect }) => {
  const handler: Partial<xml.interfaces.SAXHandler> = {
    onError: vi.fn(),
  };
  const stream = new XMLTextToSAXEventWritableStream(handler);

  // 属性が正しくない（クォートなし）
  const writer = stream.getWriter();
  await writer.write("<tag attr=foo></tag>");
  await writer.close();

  expect(handler.onError).toHaveBeenCalledWith(expect.any(Error));
});

test("parseBuffer throws synchronously in write and handled in onError", async ({ expect }) => {
  const handler: Partial<xml.interfaces.SAXHandler> = {
    onError: vi.fn(),
    onStartElement() {
      throw new Error("handler error");
    },
  };
  const stream = new XMLTextToSAXEventWritableStream(handler);
  await stream.getWriter().write("<test/>");
  expect(handler.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "handler error" }));
});

test("XMLTextToSAXParser error cases and getters", ({ expect }) => {
  const errors: unknown[] = [];
  const parser = new xml.streams.XMLTextToSAXParser({
    handler: {
      onError: err => errors.push(err),
      onComment: () => {
        // throw non-Error
        throw "non-error thrown" as unknown as Error;
      },
    },
  });
  expect(parser.buffer).toBe("");
  expect(parser.acc).toBe("");
  parser.error("custom reason");
  expect(errors.at(-1)).toBe("custom reason");

  // non-Error thrown in handler
  parser.enqueue("<!--comment-->");
  expect(errors.at(-1)).toBeInstanceOf(xml.streams.XMLTextToSAXParserError);

  // incomplete syntax on flush
  const parser2 = new xml.streams.XMLTextToSAXParser({
    handler: { onError: err => errors.push(err) },
  });
  parser2.enqueue("<incomplete");
  parser2.flush();
  expect(errors.at(-1)).toBeInstanceOf(xml.streams.XMLTextToSAXParserError);

  // invalid processing instruction (empty target)
  const parser3 = new xml.streams.XMLTextToSAXParser({
    handler: { onError: err => errors.push(err) },
  });
  parser3.enqueue("<??>");
  expect(errors.at(-1)).toBeInstanceOf(xml.streams.XMLTextToSAXParserError);

  // invalid xml-stylesheet declaration (missing href/type)
  const parser4 = new xml.streams.XMLTextToSAXParser({
    handler: { onError: err => errors.push(err) },
  });
  parser4.enqueue("<?xml-stylesheet type=\"text/xsl\"?>");
  expect(errors.at(-1)).toBeInstanceOf(xml.streams.XMLTextToSAXParserError);
  expect((errors.at(-1) as Error).message).toContain("xml-stylesheet");

  // processing instruction with single-quoted attribute
  const events5: unknown[] = [];
  const parser5 = new xml.streams.XMLTextToSAXParser({
    handler: { onProcessingInstruction: ev => events5.push(ev) },
  });
  parser5.enqueue("<?xml version='1.0' encoding='UTF-8'?>");
  expect(events5).toHaveLength(1);

  // invalid doctype syntax
  let doctypeErr: unknown;
  const parser6 = new xml.streams.XMLTextToSAXParser({
    handler: {
      onDoctype: vi.fn(),
      onError: err => doctypeErr = err,
    },
  });
  parser6.enqueue("<!DOCTYPE root INVALID>");
  expect(doctypeErr).toBeInstanceOf(xml.streams.XMLTextToSAXParserError);

  // invalid tag syntax
  const parser7 = new xml.streams.XMLTextToSAXParser({
    handler: { onError: err => errors.push(err) },
  });
  parser7.enqueue("<>");
  expect(errors.at(-1)).toBeInstanceOf(xml.streams.XMLTextToSAXParserError);
});
