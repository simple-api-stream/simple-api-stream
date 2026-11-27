import { describe, expect, it } from "vitest";
import {
  INITextToSAITransformStream,
  ResolveToSAIReadableStream,
  SAIToINITextTransformStream,
  streams,
} from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAIToINITextTransformStream", () => {
  it("serializes SAI events with comment prefix preservation", async () => {
    const stream = new ResolveToSAIReadableStream((r) => {
      r.startDocument();
      r.comment(" semi", ";");
      r.comment(" hash", "#");
      r.comment(" default");
      r.section("server");
      r.entry("host", "localhost");
      r.entry("greeting", " hello\nworld ");
      r.entry("empty", "");
      r.endDocument();
    });

    const chunks = await Array.fromAsync(
      stream.pipeThrough(new SAIToINITextTransformStream({ comments: true, summarize: "document" })),
    );

    expect(chunks).toEqual([
      "; semi\n# hash\n; default\n[server]\nhost=localhost\ngreeting=\" hello\\nworld \"\nempty=\n",
    ]);
  });

  it("supports summarize: section", async () => {
    const stream = new ResolveToSAIReadableStream((r) => {
      r.startDocument();
      r.entry("top", "1");
      r.section("a");
      r.entry("x", "10");
      r.section("b");
      r.entry("y", "20");
      r.endDocument();
    });

    const chunks = await Array.fromAsync(
      stream.pipeThrough(new SAIToINITextTransformStream({ summarize: "section" })),
    );

    expect(chunks).toEqual([
      "top=1\n",
      "[a]\nx=10\n",
      "[b]\ny=20\n",
    ]);
  });

  it("round-trips quoted and escaped values cleanly", async () => {
    const original = "[sec]\na=\" leading and trailing \"\nb=\"line1\\nline2\\t\\\\\\\"end\\\"\"\nc=plain\n";
    const out = (await Array.fromAsync(
      from([original])
        .pipeThrough(new INITextToSAITransformStream())
        .pipeThrough(new SAIToINITextTransformStream({ summarize: true })),
    )).join("");

    expect(out).toBe(original);
  });

  it("errors on invalid events or empty delimiter", async () => {
    expect(() => new SAIToINITextTransformStream({ delimiter: "" })).toThrow(streams.SAIToINITextTransformStreamError);

    await expect(
      Array.fromAsync(
        from([{ name: "endDocument" as const }])
          .pipeThrough(new SAIToINITextTransformStream()),
      ),
    ).rejects.toThrow(streams.SAIToINITextTransformStreamError);

    await expect(
      Array.fromAsync(
        from([{ name: "section" as const, section: "bad]name" }])
          .pipeThrough(new SAIToINITextTransformStream()),
      ),
    ).rejects.toThrow(streams.SAIToINITextTransformStreamError);
  });
});
