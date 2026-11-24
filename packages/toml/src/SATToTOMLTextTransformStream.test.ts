import { describe, expect, test } from "vitest";
import { ResolveToSATReadableStream, SATToTOMLTextTransformStream, TOMLTextToSATTransformStream } from "./index.js";
import type { SATEventInterface } from "./event-interface/index.js";

async function serializeEvents(events: SATEventInterface[], options?: ConstructorParameters<typeof SATToTOMLTextTransformStream>[0]): Promise<string[]> {
  const readable = new ReadableStream<SATEventInterface>({
    start(controller) {
      for (const e of events) controller.enqueue(e);
      controller.close();
    },
  });
  const out: string[] = [];
  await readable.pipeThrough(new SATToTOMLTextTransformStream(options)).pipeTo(new WritableStream({
    write(chunk) {
      out.push(chunk);
    },
  }));
  return out;
}

describe("SATToTOMLTextTransformStream & ResolveToSATReadableStream", () => {
  test("serializes programmatically resolved SAT events to TOML text", async () => {
    using stream = new ResolveToSATReadableStream((r) => {
      r.startDocument();
      r.comment(" generated");
      r.key(["title"]);
      r.value("string", "Hello");
      r.key(["quoted.key"]);
      r.value("boolean", false);
      r.key(["nums"]);
      r.startArray();
      r.value("float", Number.NaN);
      r.value("float", Infinity);
      r.value("float", -Infinity);
      r.value("float", -0);
      r.value("float", 2);
      r.value("float", 1.5);
      r.endArray();
      r.key(["dates"]);
      r.startArray();
      r.value("offsetDateTime", "1979-05-27T07:32:00Z");
      r.value("localDateTime", "1979-05-27T07:32:00");
      r.value("localDate", "1979-05-27");
      r.value("localTime", "07:32:00");
      r.endArray();
      r.table(["server", "main"]);
      r.key(["ports"]);
      r.startArray();
      r.value("integer", 8080);
      r.value("integer", 8443);
      r.endArray();
      r.arrayTable(["items"]);
      r.key(["meta"]);
      r.startInlineTable();
      r.key(["active"]);
      r.value("boolean", true);
      r.key(["count"]);
      r.value("integer", 1);
      r.endInlineTable();
      r.endDocument();
    });

    const serializer = new SATToTOMLTextTransformStream({ comments: true, summarize: true, lineBreak: "\r\n" });
    expect(serializer.status.inDocument).toBe(false);

    const chunks: string[] = [];
    await stream
      .pipeThrough(serializer)
      .pipeTo(new WritableStream({
        write(chunk) {
          chunks.push(chunk);
        },
      }));

    expect(chunks).toEqual([
      [
        "# generated",
        "title = \"Hello\"",
        "\"quoted.key\" = false",
        "nums = [nan, inf, -inf, -0.0, 2.0, 1.5]",
        "dates = [1979-05-27T07:32:00Z, 1979-05-27T07:32:00, 1979-05-27, 07:32:00]",
        "[server.main]",
        "ports = [8080, 8443]",
        "[[items]]",
        "meta = {active = true, count = 1}",
        "",
      ].join("\r\n"),
    ]);
  });

  test("round-trips TOML through SATToTOMLTextTransformStream with default and flush summarize", async () => {
    const input = "a = 1\n[tbl]\nb = \"ok\"\n[[items]]\nx = inf\n";
    const readable = new ReadableStream<string>({
      start(c) {
        c.enqueue(input);
        c.close();
      },
    });
    const out: string[] = [];
    await readable
      .pipeThrough(new TOMLTextToSATTransformStream())
      .pipeThrough(new SATToTOMLTextTransformStream({ summarize: false }))
      .pipeTo(new WritableStream({
        write(chunk) {
          out.push(chunk);
        },
      }));
    expect(out.join("")).toBe(input);

    const flushed = await serializeEvents([
      { name: "comment", comment: " ignored" },
      { name: "key", path: ["x"] },
      { name: "value", type: "integer", value: 1 },
    ], { summarize: "document" });
    expect(flushed).toEqual(["x = 1\n"]);
  });

  test("ResolveToSATReadableStream handles rejected async resolver and cancel", async () => {
    const rejectingStream = new ResolveToSATReadableStream(() => Promise.reject(new Error("boom")));
    await expect(rejectingStream.getReader().read()).rejects.toThrow("boom");

    let rejectFn!: (err: Error) => void;
    const canceledBeforeReject = new ResolveToSATReadableStream(() => new Promise<void>((_, reject) => {
      rejectFn = reject;
    }));
    await canceledBeforeReject.cancel();
    rejectFn(new Error("ignored after cancel"));
    await Promise.resolve();

    const cancelableStream = new ResolveToSATReadableStream();
    await cancelableStream.cancel();
    cancelableStream.close(); // idempotent after cancel
  });

  test("throws on invalid SAT event sequences in SATToTOMLTextTransformStream", async () => {
    await expect(serializeEvents([{ name: "startDocument", kind: "toml" }, { name: "startDocument", kind: "toml" }])).rejects.toThrow(/already in document/);
    await expect(serializeEvents([{ name: "endDocument" }])).rejects.toThrow(/outside document/);
    await expect(serializeEvents([{ name: "startDocument", kind: "toml" }, { name: "key", path: ["a"] }, { name: "endDocument" }])).rejects.toThrow(/unclosed container/);
    await expect(serializeEvents([{ name: "key", path: ["a"] }, { name: "table", path: ["t"] }])).rejects.toThrow(/Unexpected table/);
    await expect(serializeEvents([{ name: "key", path: ["a"] }, { name: "arrayTable", path: ["t"] }])).rejects.toThrow(/Unexpected arrayTable/);
    await expect(serializeEvents([{ name: "key", path: ["a"] }, { name: "key", path: ["b"] }])).rejects.toThrow(/Unexpected key/);
    await expect(serializeEvents([{ name: "key", path: ["a"] }, { name: "startArray" }, { name: "key", path: ["b"] }])).rejects.toThrow(/Unexpected key inside array/);
    await expect(serializeEvents([{ name: "endArray" }])).rejects.toThrow(/Unexpected endArray/);
    await expect(serializeEvents([{ name: "endInlineTable" }])).rejects.toThrow(/Unexpected endInlineTable/);
    await expect(serializeEvents([{ name: "key", path: ["a"] }])).rejects.toThrow(/Unexpected end of stream/);
  });
});
