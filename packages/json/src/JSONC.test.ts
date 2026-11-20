import { describe, expect, it } from "vitest";
import {
  JSONTextToSAJEventWritableStream,
  JSONTextToSAJTransformStream,
  ResolveToSAJReadableStream,
  SAJToJSONTextTransformStream,
  SAJToObjectTransformStream,
  streams,
} from "./index.js";

function fromChunks(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("JSONC options (allowComments / allowTrailingCommas)", () => {
  it("rejects comments and trailing commas by default", async () => {
    await expect(
      Array.fromAsync(fromChunks(["// comment\n{}"]).pipeThrough(new JSONTextToSAJTransformStream())),
    ).rejects.toThrow(streams.JSONTextToSAJParserError);

    await expect(
      Array.fromAsync(fromChunks(["[1, 2,]"]).pipeThrough(new JSONTextToSAJTransformStream())),
    ).rejects.toThrow(streams.JSONTextToSAJParserError);
  });

  it("parses line and block comments across chunks when allowComments: true", async () => {
    const input = [
      "// leading\n",
      "{ /* key",
      " comment */ \"a\" : /* val */ 1,",
      " \"b\": [/* item */ true] }",
      " // trailing",
    ];
    const events = await Array.fromAsync(
      fromChunks(input).pipeThrough(new JSONTextToSAJTransformStream({ allowComments: true })),
    );

    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startDocument", kind: "json" },
      { name: "comment", comment: " leading", style: "line" },
      { name: "startObject" },
      { name: "comment", comment: " key comment ", style: "block" },
      { name: "key", key: "a" },
      { name: "comment", comment: " val ", style: "block" },
      { name: "value", type: "number", value: 1 },
      { name: "key", key: "b" },
      { name: "startArray" },
      { name: "comment", comment: " item ", style: "block" },
      { name: "value", type: "boolean", value: true },
      { name: "endArray" },
      { name: "endObject" },
      { name: "comment", comment: " trailing", style: "line" },
      { name: "endDocument" },
    ]);
  });

  it("parses trailing commas in objects and arrays when allowTrailingCommas: true", async () => {
    const objects = await Array.fromAsync(
      fromChunks(["{\"a\": [1, 2,], \"b\": {\"c\": 3,},}"])
        .pipeThrough(new JSONTextToSAJTransformStream({ allowTrailingCommas: true }))
        .pipeThrough(new SAJToObjectTransformStream()),
    );
    expect(objects).toEqual([{ a: [1, 2], b: { c: 3 } }]);
  });

  it("ignores comments in SAJToObjectTransformStream", async () => {
    const objects = await Array.fromAsync(
      fromChunks(["/* top */ {\"a\": /* c */ [1, /* d */ 2]}"])
        .pipeThrough(new JSONTextToSAJTransformStream({ allowComments: true }))
        .pipeThrough(new SAJToObjectTransformStream()),
    );
    expect(objects).toEqual([{ a: [1, 2] }]);
  });

  it("omits comments by default in SAJToJSONTextTransformStream and emits them when comments: true", async () => {
    const input = "// head\n{\"a\": /* mid */ 1}";
    const withoutComments = await Array.fromAsync(
      fromChunks([input])
        .pipeThrough(new JSONTextToSAJTransformStream({ allowComments: true }))
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document" })),
    );
    expect(withoutComments.join("")).toBe("{\"a\":1}");

    const withComments = await Array.fromAsync(
      fromChunks([input])
        .pipeThrough(new JSONTextToSAJTransformStream({ allowComments: true }))
        .pipeThrough(new SAJToJSONTextTransformStream({ summarize: "document", comments: true, indent: 2 })),
    );
    expect(withComments.join("")).toBe("// head\n{\n  \"a\": /* mid */1\n}");
  });

  it("supports onComment in JSONTextToSAJEventWritableStream and comment() in ResolveToSAJReadableStream", async () => {
    const seen: Array<{ comment: string, style?: string }> = [];
    const writable = new JSONTextToSAJEventWritableStream(
      {
        onComment: ({ comment, style }) => seen.push({ comment, style }),
      },
      { allowComments: true },
    );
    await fromChunks(["// hello\n{}"]).pipeTo(writable);
    expect(seen).toEqual([{ comment: " hello", style: "line" }]);

    const resolver = new ResolveToSAJReadableStream();
    resolver.startDocument();
    resolver.comment("note", "block");
    resolver.startObject();
    resolver.endObject();
    resolver.endDocument();
    resolver.close();
    const events = await Array.fromAsync(resolver);
    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startDocument", kind: "json" },
      { name: "comment", comment: "note", style: "block" },
      { name: "startObject" },
      { name: "endObject" },
      { name: "endDocument" },
    ]);
  });
});
