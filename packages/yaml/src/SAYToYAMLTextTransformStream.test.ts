import { describe, expect, it } from "vitest";
import {
  ResolveToSAYReadableStream,
  SAYToObjectTransformStream,
  SAYToYAMLTextTransformStream,
  YAMLTextToSAYTransformStream,
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

describe("SAYToYAMLTextTransformStream", () => {
  it("serializes block and flow collections, empty collections, comments, anchors, aliases, and special numbers", async () => {
    const stream = new ResolveToSAYReadableStream((r) => {
      r.startDocument();
      r.comment(" header");
      r.startMapping();
      r.key("title");
      r.scalar("string", "hello");
      r.key("quoted");
      r.scalar("string", "true");
      r.key("emptyMap");
      r.startMapping();
      r.endMapping();
      r.key("emptySeq");
      r.startSequence();
      r.endSequence();
      r.key("flow");
      r.startSequence({ flow: true, anchor: "f" });
      r.scalar("number", 1);
      r.scalar("number", Number.POSITIVE_INFINITY);
      r.scalar("number", Number.NEGATIVE_INFINITY);
      r.scalar("number", Number.NaN);
      r.scalar("boolean", true);
      r.scalar("null", null);
      r.endSequence();
      r.key("ref");
      r.alias("f");
      r.endMapping();
      r.endDocument();

      // Second document triggers automatic ---
      r.startDocument();
      r.startMapping({ flow: true });
      r.key("a");
      r.scalar("string", "x");
      r.key("b");
      r.scalar("number", 2);
      r.endMapping();
      r.endDocument();
    });

    const serializer = new SAYToYAMLTextTransformStream({ comments: true, summarize: "document" });
    expect(serializer.status.summarize).toBe("document");
    const docs = await Array.fromAsync(stream.pipeThrough(serializer));

    expect(docs).toEqual([
      [
        "# header",
        "title: hello",
        "quoted: \"true\"",
        "emptyMap: {}",
        "emptySeq: []",
        "flow: &f [1, .inf, -.inf, .nan, true, null]",
        "ref: *f",
        "",
      ].join("\n"),
      "---\n{a: \"x\", b: 2}\n",
    ]);
  });

  it("round-trips nested objects and sequences through YAML text", async () => {
    const input = "a: 1\nnested:\n  - x: true\n    y: null\n  - z: \"line1\\nline2\"\n";
    const out = (await Array.fromAsync(
      from([input])
        .pipeThrough(new YAMLTextToSAYTransformStream())
        .pipeThrough(new SAYToYAMLTextTransformStream({ summarize: true })),
    )).join("");

    const [reparsed] = await Array.fromAsync(
      from([out])
        .pipeThrough(new YAMLTextToSAYTransformStream())
        .pipeThrough(new SAYToObjectTransformStream()),
    );
    expect(reparsed).toEqual({
      a: 1,
      nested: [
        { x: true, y: null },
        { z: "line1\nline2" },
      ],
    });
  });

  it("supports ResolveToSAYReadableStream manual close, cancel, reject, and dispose", async () => {
    const manual = new ResolveToSAYReadableStream();
    manual.startDocument();
    manual.scalar("string", "ok");
    manual.endDocument();
    manual.close();
    manual.close();
    expect(await Array.fromAsync(manual)).toHaveLength(3);

    const disposed = new ResolveToSAYReadableStream();
    disposed[Symbol.dispose]();
    expect(await Array.fromAsync(disposed)).toEqual([]);

    const failing = new ResolveToSAYReadableStream(() => Promise.reject(new Error("boom")));
    await expect(Array.fromAsync(failing)).rejects.toThrow("boom");

    let rejectLater!: (err: Error) => void;
    const cancelFirst = new ResolveToSAYReadableStream(() => new Promise<void>((_, reject) => {
      rejectLater = reject;
    }));
    await cancelFirst.getReader().cancel();
    rejectLater(new Error("ignored"));
    await Promise.resolve();
  });

  it("errors on invalid options or event sequences", async () => {
    expect(() => new SAYToYAMLTextTransformStream({ indent: 0 })).toThrow(streams.SAYToYAMLTextTransformStreamError);

    await expect(
      Array.fromAsync(
        from([{ name: "endDocument" as const }]).pipeThrough(new SAYToYAMLTextTransformStream()),
      ),
    ).rejects.toThrow(streams.SAYToYAMLTextTransformStreamError);

    await expect(
      Array.fromAsync(
        from([{ name: "key" as const, key: "a" }]).pipeThrough(new SAYToYAMLTextTransformStream()),
      ),
    ).rejects.toThrow(streams.SAYToYAMLTextTransformStreamError);

    await expect(
      Array.fromAsync(
        from([{ name: "startMapping" as const }]).pipeThrough(new SAYToYAMLTextTransformStream()),
      ),
    ).rejects.toThrow(streams.SAYToYAMLTextTransformStreamError);
  });
});
