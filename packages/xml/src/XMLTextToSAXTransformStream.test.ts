import { test, describe, expect } from "vitest";
import { XMLTextToSAXTransformStream } from "./index.js";
import type * as xml from "./index.js";
function collectEvents(stream: TransformStream<string, xml.eventInterfaces.SAXEventInterface>, xml: string) {
  const reader = stream.readable.getReader();
  const writer = stream.writable.getWriter();
  const output: string[] = [];

  return (async () => {
    void (async () => {
      for (const chunk of xml.match(/.{1,10}/g) ?? []) {
        await writer.write(chunk);
      }
      await writer.close();
    })();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      switch (value.name) {
        case "startElement":
          output.push(`start:${value.tagName}:${JSON.stringify(value.attrs)}:${value.selfClosing}`);
          break;
        case "endElement":
          output.push(`end:${value.tagName}`);
          break;
        case "text":
          output.push(`text:${value.text}`);
          break;
        case "comment":
          output.push(`comment:${value.comment}`);
          break;
        case "cdata":
          output.push(`cdata:${value.cdata}`);
          break;
        case "doctype":
          if (value.dtdType === "PUBLIC")
            output.push(`doctype:${value.root}:${value.dtdType}:${value.identifier}:${value.uri}:${value.declarations?.join(",") ?? ""}`);
          else if (value.dtdType === "SYSTEM")
            output.push(`doctype:${value.root}:${value.dtdType}:${value.uri}:${value.declarations?.join(",") ?? ""}`);
          else
            output.push(`doctype:${value.root}:${value.declarations?.join(",") ?? ""}`);
          break;
        case "processingInstruction":
          output.push(`processingInstruction:${value.target}:${value.data}`);
          break;
      }
    }

    return output;
  })();
}

test("SimpleSAXTransformStream parses XML stream correctly", async ({ expect }) => {
  const xml = "<!DOCTYPE root><root attr=\"value\">text<!--comment--><![CDATA[cdata]]><child attr2=\"v2\"/></root>";
  const stream = new XMLTextToSAXTransformStream();
  const events = await collectEvents(stream, xml);

  expect(events).toEqual([
    "doctype:root:",
    "start:root:{\"attr\":\"value\"}:false",
    "text:text",
    "comment:comment",
    "cdata:cdata",
    "start:child:{\"attr2\":\"v2\"}:true",
    "end:child",
    "end:root",
  ]);
  expect(stream.status).toEqual({
    acc: "",
    buffer: "",
    openDocumented: false,
    state: "text",
  });
});

test("SimpleSAXTransformStream handles malformed XML", async ({ expect }) => {
  const { readable, writable } = new XMLTextToSAXTransformStream();
  const writer = writable.getWriter();
  const reader = readable.getReader();
  const writed = (async () => {
    await writer.write("<tag attr=foo></tag>");
    await writer.close();
  })();
  await expect(() => reader.read()).rejects.toThrow("Invalid or unquoted attribute syntax near: attr=foo");
  await expect(writed).rejects.toThrow("Invalid or unquoted attribute syntax near: attr=foo");
});

test("parses xml declaration and stylesheet", async ({ expect }) => {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<?xml-stylesheet type="text/xsl" href="style.xsl"?>
<root/>`;
  const stream = new XMLTextToSAXTransformStream();
  const events = await collectEvents(stream, xml);

  expect(events).toEqual([
    `processingInstruction:xml:version="1.0" encoding="UTF-8" standalone="no"`,
    `processingInstruction:xml-stylesheet:type="text/xsl" href="style.xsl"`,
    "start:root:{}:true",
    "end:root",
  ]);
});

describe("pattern test", (it) => {
  const entries: {
    name: string
    options?: ConstructorParameters<typeof XMLTextToSAXTransformStream>[0]
    input: string[]
    output: xml.eventInterfaces.SAXEventInterface[]
  }[] = [
    {
      name: "DOCTYPE HTML 4.01 Strict",
      options: { skipDocument: true },
      input: [
        `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">`,
      ],
      output: [
        { name: "doctype", root: "HTML", dtdType: "PUBLIC", identifier: "-//W3C//DTD HTML 4.01//EN", uri: "http://www.w3.org/TR/html4/strict.dtd" },
      ],
    },
    {
      name: "DOCTYPE HTML 4.01 Transitional",
      options: { skipDocument: true },
      input: [
        `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">`,
      ],
      output: [
        { name: "doctype", root: "HTML", dtdType: "PUBLIC", identifier: "-//W3C//DTD HTML 4.01 Transitional//EN", uri: "http://www.w3.org/TR/html4/loose.dtd" },
      ],
    },
    {
      name: "DOCTYPE internal subset",
      options: { skipDocument: true },
      input: [
        `<!DOCTYPE person [
      <!ELEMENT person (name, age, city)>
      <!ELEMENT name (#PCDATA)>
      <!ELEMENT age (#PCDATA)>
      <!ELEMENT city (#PCDATA)>
    ]>
    <person><name>Alice</name><age>30</age><city>New York</city></person>`,
      ],
      output: [
        {
          name: "doctype",
          root: "person",
          declarations: [
            `<!ELEMENT person (name, age, city)>`,
            `<!ELEMENT name (#PCDATA)>`,
            `<!ELEMENT age (#PCDATA)>`,
            `<!ELEMENT city (#PCDATA)>`,
          ],
        },
        { name: "startElement", tagName: "person", attrs: {}, selfClosing: false },
        { name: "startElement", tagName: "name", attrs: {}, selfClosing: false },
        { name: "text", text: "Alice" },
        { name: "endElement", tagName: "name" },
        { name: "startElement", tagName: "age", attrs: {}, selfClosing: false },
        { name: "text", text: "30" },
        { name: "endElement", tagName: "age" },
        { name: "startElement", tagName: "city", attrs: {}, selfClosing: false },
        { name: "text", text: "New York" },
        { name: "endElement", tagName: "city" },
        { name: "endElement", tagName: "person" },
      ],
    },
    {
      name: "INTERNAL DOCTYPE HTML",
      options: { skipDocument: true },
      input: [
        `<!doctype myown system "file:///HD/docs/dtd/myown.dtd">`,
      ],
      output: [
        { name: "doctype", dtdType: "SYSTEM", root: "myown", uri: "file:///HD/docs/dtd/myown.dtd" },
      ],
    },
    {
      name: "outputs correct XML chunks",
      options: { skipDocument: true },
      input: [`
          <root id="123">Hello &lt;world&gt; &amp; othe&#x72;&#115;<empty/><!----></root>`],
      output: [
        { name: "startElement", tagName: "root", attrs: { id: "123" }, selfClosing: false },
        { name: "text", text: "Hello <world> & others" },
        { name: "startElement", tagName: "empty", attrs: {}, selfClosing: true },
        { name: "endElement", tagName: "empty" },
        { name: "comment", comment: "" },
        { name: "endElement", tagName: "root" },
      ],
    },
    {
      name: "all type",
      input: [
        `<?xml version="1.0 ?><?xml-stylesheet type="text/xls" href="./style.xls" ?><root><![CDATA[ hoge ]]><!-- fuga --><element>piyo</element></root>`,
      ],
      output: [
        { name: "startDocument", kind: "xml" },
        {
          data: `version="1.0" encoding="UTF-8"`,
          encoding: "UTF-8",
          standalone: "yes",
          target: "xml",
          name: "processingInstruction",
          version: "1.0",
        },
        {
          type: "text/xls",
          data: `type="text/xls" href="./style.xls"`,
          href: "./style.xls",
          target: "xml-stylesheet",
          name: "processingInstruction",
        },
        {
          attrs: {},
          selfClosing: false,
          tagName: "root",
          name: "startElement",
        },
        {
          cdata: " hoge ",
          name: "cdata",
        },
        {
          comment: " fuga ",
          name: "comment",
        },
        {
          attrs: {},
          selfClosing: false,
          tagName: "element",
          name: "startElement",
        },
        {
          text: "piyo",
          name: "text",
        },
        {
          tagName: "element",
          name: "endElement",
        },
        {
          tagName: "root",
          name: "endElement",
        },
        { name: "endDocument" },
      ],
    },
    {
      name: "<?test ?>",
      input: [
        "<?test ?>",
      ],
      output: [
        { name: "startDocument", kind: "xml" },
        { name: "processingInstruction", target: "test", data: "" },
        { name: "endDocument" },
      ],
    },
    {
      name: "tag attrs",
      input: [
        `<img src='example.com/.gif' id="test" />`,
      ],
      output: [
        { name: "startDocument", kind: "xml" },
        {
          name: "startElement",
          attrs: {
            src: "example.com/.gif",
            id: "test",
          },
          tagName: "img",
          selfClosing: true,
        },
        { name: "endElement", tagName: "img" },
        { name: "endDocument" },
      ],
    },
    {
      name: "empty input",
      input: [
        ``,
      ],
      output: [],
    },
    {
      name: "greater-than inside quoted attribute values",
      input: [
        `<a title="1 > 0" data-expr='a => b'>hi</a>`,
      ],
      output: [
        { name: "startDocument", kind: "xml" },
        { name: "startElement", tagName: "a", attrs: { "title": "1 > 0", "data-expr": "a => b" }, selfClosing: false },
        { name: "text", text: "hi" },
        { name: "endElement", tagName: "a" },
        { name: "endDocument" },
      ],
    },
    {
      name: "unicode tag and attribute names with whitespace around =",
      input: [
        `<日本語 属性 = "値">テスト</日本語>`,
      ],
      output: [
        { name: "startDocument", kind: "xml" },
        { name: "startElement", tagName: "日本語", attrs: { 属性: "値" }, selfClosing: false },
        { name: "text", text: "テスト" },
        { name: "endElement", tagName: "日本語" },
        { name: "endDocument" },
      ],
    },
    {
      name: "leading comment emits startDocument first and does not unescape comment",
      input: [
        `<!-- &lt;tag&gt; --><root></root>\n`,
      ],
      output: [
        { name: "startDocument", kind: "xml" },
        { name: "comment", comment: " &lt;tag&gt; " },
        { name: "startElement", tagName: "root", attrs: {}, selfClosing: false },
        { name: "endElement", tagName: "root" },
        { name: "endDocument" },
      ],
    },
    {
      name: "processing instruction without data and with newline separator",
      input: [
        `<?mypi?><?xml\nversion="1.0"?><a/>`,
      ],
      output: [
        { name: "startDocument", kind: "xml" },
        { name: "processingInstruction", target: "mypi", data: "" },
        {
          name: "processingInstruction",
          target: "xml",
          data: `version="1.0" encoding="UTF-8"`,
          version: "1.0",
          encoding: "UTF-8",
          standalone: "yes",
        },
        { name: "startElement", tagName: "a", attrs: {}, selfClosing: true },
        { name: "endElement", tagName: "a" },
        { name: "endDocument" },
      ],
    },
    {
      name: "trailing text is unescaped on flush",
      input: [
        `a &amp; b`,
      ],
      output: [
        { name: "startDocument", kind: "xml" },
        { name: "text", text: "a & b" },
        { name: "endDocument" },
      ],
    },
  ];
  it.each(entries)(
    `$name`,
    async ({ input, output, options }) => {
      const { readable, writable } = new XMLTextToSAXTransformStream(options);
      void (async (xml, writer) => {
        for (const x of xml)
          for (const chunk of x.match(/[\s\S]{1,10}/g) ?? []) {
            await writer.write(chunk);
          }
        await writer.close();
      })(input, writable.getWriter());
      const array = await Array.fromAsync(readable);
      expect(array).toEqual(output);
    },
  );
});

test("reports explicit state names during incomplete chunks", async ({ expect }) => {
  const stream = new XMLTextToSAXTransformStream();
  const writer = stream.writable.getWriter();
  const readed = Array.fromAsync(stream.readable);

  await writer.write("<root");
  expect(stream.status.state).toBe("tag");
  await writer.write("><!--com");
  expect(stream.status.state).toBe("comment");
  await writer.write("--><![CDATA[cd");
  expect(stream.status.state).toBe("cdata");
  await writer.write("]]></root>");
  await writer.close();
  await readed;
  expect(stream.status.state).toBe("text");
});

test("rejects invalid attribute before valid attribute and invalid closing tag", async ({ expect }) => {
  for (const badXml of [
    `<a invalid foo="1"/>`,
    `<a foo="1"bar="2"/>`,
    `<a></a foo="1">`,
    `<123/>`,
  ]) {
    const stream = new XMLTextToSAXTransformStream();
    const writer = stream.writable.getWriter();
    const readed = Array.fromAsync(stream.readable);
    const writed = (async () => {
      await writer.write(badXml);
      await writer.close();
    })();
    await expect(readed).rejects.toThrow();
    await expect(writed).rejects.toThrow();
  }
});

test("rejects mismatched, stray, and unclosed tags", async ({ expect }) => {
  for (const [badXml, expectedMessage] of [
    [`<a></b>`, `Mismatched closing tag: expected </a>, got </b>`],
    [`<a><b></a></b>`, `Mismatched closing tag: expected </b>, got </a>`],
    [`</a>`, `Unexpected closing tag </a>`],
    [`<a><b></b>`, `not complete syntax error`],
  ] as const) {
    const stream = new XMLTextToSAXTransformStream();
    const writer = stream.writable.getWriter();
    const readed = Array.fromAsync(stream.readable);
    const writed = (async () => {
      await writer.write(badXml);
      await writer.close();
    })();
    await expect(readed).rejects.toThrow(expectedMessage);
    await expect(writed).rejects.toThrow(expectedMessage);
  }
});
