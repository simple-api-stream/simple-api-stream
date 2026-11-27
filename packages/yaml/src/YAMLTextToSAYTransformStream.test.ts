import { describe, expect, it } from "vitest";
import {
  SAYToObjectTransformStream,
  YAMLTextToSAYEventWritableStream,
  YAMLTextToSAYTransformStream,
  streams,
  type eventInterfaces,
} from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

async function parseYAMLObjects(
  input: string | string[],
  options?: ConstructorParameters<typeof YAMLTextToSAYTransformStream>[0],
): Promise<unknown[]> {
  const chunks = typeof input === "string" ? [input] : input;
  return await Array.fromAsync(
    from(chunks)
      .pipeThrough(new YAMLTextToSAYTransformStream(options))
      .pipeThrough(new SAYToObjectTransformStream()),
  );
}

async function parseYAMLEvents(
  input: string | string[],
  options?: ConstructorParameters<typeof YAMLTextToSAYTransformStream>[0],
): Promise<eventInterfaces.SAYEventInterface[]> {
  const chunks = typeof input === "string" ? [input] : input;
  return await Array.fromAsync(
    from(chunks).pipeThrough(new YAMLTextToSAYTransformStream(options)),
  );
}

describe("YAMLTextToSAYTransformStream", () => {
  it("parses block mappings, sequences, same-indent sequences, and compact nested items", async () => {
    const yaml = [
      "name: simple-api-stream",
      "version: 1",
      "active: true",
      "disabled: FALSE",
      "empty:",
      "tilde: ~",
      "tags:",
      "- yaml",
      "- streaming",
      "items:",
      "  - id: 1",
      "    title: first",
      "  - id: 2",
      "    title: second",
      "  -",
      "matrix:",
      "  - - 1",
      "    - 2",
      "  - - 3",
    ].join("\n");

    const docs = await parseYAMLObjects(yaml);
    expect(docs).toEqual([
      {
        name: "simple-api-stream",
        version: 1,
        active: true,
        disabled: false,
        empty: null,
        tilde: null,
        tags: ["yaml", "streaming"],
        items: [
          { id: 1, title: "first" },
          { id: 2, title: "second" },
          null,
        ],
        matrix: [[1, 2], [3]],
      },
    ]);
  });

  it("resolves YAML 1.2 Core Schema scalars and quoted strings with escapes", async () => {
    const yaml = [
      "dec: -42",
      "oct: 0o755",
      "hex: 0x1A",
      "flt: 3.14e+1",
      "posInf: .inf",
      "negInf: -.INF",
      "nanVal: .NaN",
      "strTag: !!str 123",
      "dbl: \"a\\0\\a\\b\\t\\n\\v\\f\\r\\e\\ \\\"\\/\\\\\\x41\\u0042\\U00000043\"",
      "sgl: 'it''s literal'",
      "\"quoted:key\": 1",
      "'single:key': 2",
    ].join("\n");

    const [doc] = await parseYAMLObjects(yaml) as [Record<string, unknown>];
    expect(doc.dec).toBe(-42);
    expect(doc.oct).toBe(0o755);
    expect(doc.hex).toBe(0x1a);
    expect(doc.flt).toBe(31.4);
    expect(doc.posInf).toBe(Number.POSITIVE_INFINITY);
    expect(doc.negInf).toBe(Number.NEGATIVE_INFINITY);
    expect(Number.isNaN(doc.nanVal)).toBe(true);
    expect(doc.strTag).toBe("123");
    expect(doc.dbl).toBe("a\0\x07\b\t\n\v\f\r\x1B \"/\\ABC");
    expect(doc.sgl).toBe("it's literal");
    expect(doc["quoted:key"]).toBe(1);
    expect(doc["single:key"]).toBe(2);
  });

  it("parses literal and folded block scalars with chomping and explicit indent", async () => {
    const yaml = [
      "litClip: |",
      "  line 1",
      "  line 2",
      "",
      "litStrip: |-",
      "  hello",
      "litKeep: |+",
      "  keep",
      "",
      "folded: >",
      "  hello",
      "  world",
      "",
      "  para 2",
      "    indented",
      "  after",
      "explicit: |2",
      "    two-space-leading",
      "emptyLit: |",
      "afterEmpty: ok",
    ].join("\n");

    const [doc] = await parseYAMLObjects(yaml) as [Record<string, unknown>];
    expect(doc.litClip).toBe("line 1\nline 2\n");
    expect(doc.litStrip).toBe("hello");
    expect(doc.litKeep).toBe("keep\n\n");
    expect(doc.folded).toBe("hello world\npara 2\n  indented\nafter\n");
    expect(doc.explicit).toBe("  two-space-leading\n");
    expect(doc.emptyLit).toBe("");
    expect(doc.afterEmpty).toBe("ok");
  });

  it("parses flow sequences and mappings including multi-line flow collections", async () => {
    const yaml = [
      "arr: [1, 'two', \"three\", null, { nested: true, emptyVal:, }]",
      "multi: {",
      "  # flow comment",
      "  a: [1, 2],",
      "  'b': \"ok\",",
      "  \"c\": &ref 42,",
      "  d: *ref,",
      "}",
    ].join("\n");

    const [doc] = await parseYAMLObjects(yaml, { comments: true }) as [Record<string, unknown>];
    expect(doc).toEqual({
      arr: [1, "two", "three", null, { nested: true, emptyVal: null }],
      multi: { a: [1, 2], b: "ok", c: 42, d: 42 },
    });
  });

  it("parses multi-document YAML streams with --- and ... and 1-char chunking", async () => {
    const yaml = "\uFEFF# doc 1\r\n---\r\na: 1\r\n...\r\n--- 42 # inline root\r\n---\r\n- x\r\n- y\r";
    const docs = await parseYAMLObjects([...yaml], { comments: true });
    expect(docs).toEqual([
      { a: 1 },
      42,
      ["x", "y"],
    ]);

    await expect(parseYAMLObjects("---\na: 1\n---\nb: 2\n", { multiple: false }))
      .rejects.toThrow(streams.YAMLTextToSAYParserError);
  });

  it("parses anchors, aliases, tags, and comments", async () => {
    const yaml = [
      "# top comment",
      "defaults: &def",
      "  timeout: 30",
      "service:",
      "  config: *def",
      "  label: &lbl !custom hello # inline",
      "  copy: *lbl",
      "emptyAnchored: &ea",
    ].join("\n");

    const events = await parseYAMLEvents(yaml, { comments: true });
    expect(events.some(e => e.name === "comment" && e.comment === " top comment")).toBe(true);
    expect(events.some(e => e.name === "alias" && e.alias === "def")).toBe(true);

    const [doc] = await parseYAMLObjects(yaml) as [Record<string, unknown>];
    expect(doc).toEqual({
      defaults: { timeout: 30 },
      service: { config: { timeout: 30 }, label: "hello", copy: "hello" },
      emptyAnchored: null,
    });
  });

  it("supports YAMLTextToSAYEventWritableStream and status", async () => {
    const seen: string[] = [];
    const writable = new YAMLTextToSAYEventWritableStream({
      onKey: ({ key }) => seen.push(`key:${key}`),
      onScalar: ({ value }) => seen.push(`val:${String(value)}`),
    });
    expect(writable.status.eof).toBe(false);
    await from(["a: 1\n"]).pipeTo(writable);
    expect(seen).toEqual(["key:a", "val:1"]);
    expect(writable.status.eof).toBe(true);

    let aborted: unknown;
    const abortable = new YAMLTextToSAYEventWritableStream({
      onError: (e) => { aborted = e; },
    });
    await abortable.abort("stop");
    expect(aborted).toBe("stop");

    const ts = new YAMLTextToSAYTransformStream();
    expect(ts.status.line).toBe(0);
  });

  it("reports syntax errors for malformed YAML", async () => {
    await expect(parseYAMLEvents("\tkey: 1\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: \"unterminated\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: 'unterminated\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: \"\\q\"\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: \"\\xZZ\"\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: [1, 2\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: [1, 2\n---\nb: 1\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("... extra\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: \"ok\" trailing\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: 'ok' trailing\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("a: *\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
    await expect(parseYAMLEvents("1\n2\n")).rejects.toThrow(streams.YAMLTextToSAYParserError);
  });
});
