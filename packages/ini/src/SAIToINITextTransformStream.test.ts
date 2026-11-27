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
  it("serializes SAI events with comment prefix preservation and default summarize", async () => {
    const stream = new ResolveToSAIReadableStream((r) => {
      r.startDocument();
      r.comment(" semi", ";");
      r.comment(" hash", "#");
      r.comment(" default");
      r.section("server");
      r.entry("host", "localhost");
      r.entry("greeting", " hello\n\r\0world ");
      r.entry("empty", "");
      r.endDocument();
    });

    const serializer = new SAIToINITextTransformStream({ comments: true, summarize: "document" });
    expect(serializer.status.summarize).toBe("document");
    const chunks = await Array.fromAsync(stream.pipeThrough(serializer));

    expect(chunks).toEqual([
      "; semi\n# hash\n; default\n[server]\nhost=localhost\ngreeting=\" hello\\n\\r\\0world \"\nempty=\n",
    ]);

    // Comments omitted when comments: false
    const noComments = await Array.fromAsync(
      from([
        { name: "comment" as const, comment: "ignored", prefix: ";" },
        { name: "entry" as const, key: "a", value: "1" },
      ]).pipeThrough(new SAIToINITextTransformStream({ comments: false })),
    );
    expect(noComments).toEqual(["a=1\n"]);
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

  it("supports imperative ResolveToSAIReadableStream usage, cancel, error, and dispose", async () => {
    const manual = new ResolveToSAIReadableStream();
    manual.startDocument();
    manual.entry("k", "v");
    manual.endDocument();
    manual.close();
    manual.close(); // idempotent
    expect(await Array.fromAsync(manual)).toEqual([
      { name: "startDocument", kind: "ini" },
      { name: "entry", key: "k", value: "v" },
      { name: "endDocument" },
    ]);

    const disposed = new ResolveToSAIReadableStream();
    disposed[Symbol.dispose]();
    expect(await Array.fromAsync(disposed)).toEqual([]);

    const cancellable = new ResolveToSAIReadableStream();
    const reader = cancellable.getReader();
    await reader.cancel();

    const failing = new ResolveToSAIReadableStream(() => Promise.reject(new Error("async fail")));
    await expect(Array.fromAsync(failing)).rejects.toThrow("async fail");

    let rejectLater!: (err: Error) => void;
    const cancelBeforeReject = new ResolveToSAIReadableStream(() => new Promise<void>((_, reject) => {
      rejectLater = reject;
    }));
    await cancelBeforeReject.getReader().cancel();
    rejectLater(new Error("ignored after cancel"));
    await Promise.resolve();
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
        from([
          { name: "startDocument" as const, kind: "ini" as const },
          { name: "startDocument" as const, kind: "ini" as const },
        ]).pipeThrough(new SAIToINITextTransformStream()),
      ),
    ).rejects.toThrow(streams.SAIToINITextTransformStreamError);

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

    await expect(
      Array.fromAsync(
        from([{ name: "entry" as const, key: "", value: "1" }])
          .pipeThrough(new SAIToINITextTransformStream()),
      ),
    ).rejects.toThrow(streams.SAIToINITextTransformStreamError);
  });
});
