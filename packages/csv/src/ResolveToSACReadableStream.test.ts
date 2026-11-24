import { describe, expect, it } from "vitest";
import { ResolveToSACReadableStream, streams } from "./index.js";

describe("ResolveToSACReadableStream", () => {
  it("constructs SAC events imperatively with auto-populated index and header", async () => {
    let events;
    {
      using stream = new ResolveToSACReadableStream();
      stream.startDocument();
      stream.startHeaderRow();
      stream.column("id");
      stream.column("name");
      stream.endHeaderRow();
      stream.startRecordRow();
      stream.column("1");
      stream.column("Alice");
      stream.endRecordRow();
      stream.endDocument();
      events = await Promise.resolve().then(async () => {
        stream.close();
        return await Array.fromAsync(stream);
      });
    }

    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "startHeaderRow" },
      { name: "column", value: "id", index: 0 },
      { name: "column", value: "name", index: 1 },
      { name: "endHeaderRow" },
      { name: "startRecordRow" },
      { name: "column", value: "1", index: 0, header: "id" },
      { name: "column", value: "Alice", index: 1, header: "name" },
      { name: "endRecordRow" },
      { name: "endDocument" },
    ]);
  });

  it("throws ResolveToSACReadableStreamError on invalid row nesting", async () => {
    const stream = new ResolveToSACReadableStream();
    stream.column("outside");
    stream.startRecordRow();
    stream.column("val", { header: "custom" });
    expect(() => stream.startHeaderRow()).toThrow(streams.ResolveToSACReadableStreamError);
    expect(() => stream.startRecordRow()).toThrow(streams.ResolveToSACReadableStreamError);
    expect(() => stream.endHeaderRow()).toThrow(streams.ResolveToSACReadableStreamError);
    stream.endRecordRow();
    expect(() => stream.endRecordRow()).toThrow(streams.ResolveToSACReadableStreamError);
    await stream.cancel();
    stream.close();
  });
});
