import { describe, expect, expectTypeOf, it } from "vitest";
import { ResponseStreamError } from "@simple-api-stream/core";
import {
  SSEEventToTextTransformStream,
  SSETextToEventTransformStream,
  parseSSEResponse,
  type SSEMessage,
} from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("@simple-api-stream/sse", () => {
  it("parses chunked SSE streams with BOM, multiline data, event, id, retry, comments, and mixed line endings", async () => {
    const chunks = [
      "",
      "\uFEFF: keep-alive\r",
      "\nevent: update\rid: 42\r\nretry: 3000\ndata: line1\n",
      "data:  line2\nunknown: ignored\nid: bad\0id\nretry: nope\ndata\n\n",
      "data:second\r\r",
      "data: trailing-no-blank-line",
    ];

    const events = await Array.fromAsync(
      fromIterable(chunks).pipeThrough(new SSETextToEventTransformStream({ comments: true })),
    );

    expect(events).toEqual([
      { name: "startDocument", kind: "sse" },
      { name: "comment", comment: " keep-alive" },
      { name: "message", event: "update", id: "42", retry: 3000, data: "line1\n line2\n" },
      { name: "message", id: "42", data: "second" },
      { name: "endDocument" },
    ]);
  });

  it("supports skipDocument, stripBom: false, comments: false, and flushIncomplete: true", async () => {
    const events = await Array.fromAsync(
      fromIterable([": ignored\n\ndata: final"])
        .pipeThrough(new SSETextToEventTransformStream({
          skipDocument: true,
          stripBom: false,
          comments: false,
          flushIncomplete: true,
        })),
    );
    expect(events).toEqual([
      { name: "message", data: "final" },
    ]);

    // Empty stream emits nothing
    expect(await Array.fromAsync(fromIterable([]).pipeThrough(new SSETextToEventTransformStream()))).toEqual([]);
  });

  it("serializes SSE events back to text/event-stream and round-trips", async () => {
    const input = ": hello\nevent: ping\nid: 1\nretry: 1000\ndata: a\ndata: b\n\ndata: c\n\n";
    const expected = ": hello\nevent: ping\nid: 1\nretry: 1000\ndata: a\ndata: b\n\nid: 1\ndata: c\n\n";
    const serialized = (await Array.fromAsync(
      fromIterable([input])
        .pipeThrough(new SSETextToEventTransformStream({ comments: true }))
        .pipeThrough(new SSEEventToTextTransformStream({ comments: true })),
    )).join("");
    expect(serialized).toBe(expected);

    // Comments omitted by default + custom lineBreak
    const withoutComments = (await Array.fromAsync(
      fromIterable([": skip\ndata: x\n\n"])
        .pipeThrough(new SSETextToEventTransformStream({ comments: true }))
        .pipeThrough(new SSEEventToTextTransformStream({ lineBreak: "\r\n" })),
    )).join("");
    expect(withoutComments).toBe("data: x\r\n\r\n");
  });

  it("parses Fetch Responses with parseSSEResponse and supports mapMessage + skip", async () => {
    const body = ": ping\ndata: first\n\nevent: delta\nid: 7\nretry: 500\ndata: {\"text\":\"hi\"}\n\ndata: [DONE]\n\n";
    const res = new Response(body, {
      headers: { "content-type": "text/event-stream; charset=utf-8" },
    });

    const messages = parseSSEResponse(res, { parser: { comments: true } });
    expectTypeOf(messages).toEqualTypeOf<ReadableStream<SSEMessage>>();
    expect(await Array.fromAsync(messages)).toEqual([
      { data: "first" },
      { event: "delta", id: "7", retry: 500, data: "{\"text\":\"hi\"}" },
      { id: "7", data: "[DONE]" },
    ]);

    const mapped = parseSSEResponse(
      new Response(body, { headers: { "content-type": "text/event-stream" } }),
      {
        mapMessage: (msg, { skip }) => {
          if (msg.data === "[DONE]" || msg.data === "first") return skip;
          return JSON.parse(msg.data) as { text: string };
        },
      },
    );
    expectTypeOf(mapped).toEqualTypeOf<ReadableStream<{ text: string }>>();
    expect(await Array.fromAsync(mapped)).toEqual([{ text: "hi" }]);

    // Rejects wrong Content-Type by default
    expect(() => parseSSEResponse(
      new Response("data: x\n\n", { headers: { "content-type": "text/plain" } }),
    )).toThrow(ResponseStreamError);
  });
});
