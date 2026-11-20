import { describe, expect, it } from "vitest";
import { CSVTextToSACTransformStream, ResolveToSACReadableStream, SACToCSVTextTransformStream, streams } from "./index.js";

describe("SACToCSVTextTransformStream", () => {
  it("serializes events per event when summarize is default", async () => {
    const source = new ResolveToSACReadableStream();
    const out = source.pipeThrough(new SACToCSVTextTransformStream());

    source.startDocument();
    source.startHeaderRow();
    source.column("id");
    source.column("name");
    source.endHeaderRow();
    source.startRecordRow();
    source.column("1");
    source.column("Alice, \"A\"");
    source.endRecordRow();
    source.endDocument();
    source.close();

    const chunks = await Array.fromAsync(out);
    expect(chunks).toEqual([
      "id",
      ",name",
      "\r\n",
      "1",
      ",\"Alice, \"\"A\"\"\"",
      "\r\n",
    ]);
  });

  it("summarizes by row when summarize is 'row'", async () => {
    const source = new ResolveToSACReadableStream();
    const out = source.pipeThrough(new SACToCSVTextTransformStream({ summarize: "row", lineBreak: "\n" }));

    source.startDocument();
    source.startRecordRow();
    source.column("a");
    source.column("b");
    source.endRecordRow();
    source.startRecordRow();
    source.column("1");
    source.column("2");
    source.endRecordRow();
    source.endDocument();
    source.close();

    const chunks = await Array.fromAsync(out);
    expect(chunks).toEqual(["a,b\n", "1,2\n"]);
  });

  it("summarizes whole document when summarize is 'document' or true", async () => {
    const source = new ResolveToSACReadableStream();
    const out = source.pipeThrough(new SACToCSVTextTransformStream({ summarize: true, quotePolicy: "all", lineBreak: "\n" }));

    source.startDocument();
    source.startRecordRow();
    source.column("a");
    source.column("b");
    source.endRecordRow();
    source.endDocument();
    source.close();

    const chunks = await Array.fromAsync(out);
    expect(chunks).toEqual(["\"a\",\"b\"\n"]);
  });

  it("round-trips with CSVTextToSACTransformStream", async () => {
    const input = "id,note\r\n1,\"hello\r\n\"\"world\"\"\"\r\n2,plain\r\n";
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(input);
        controller.close();
      },
    });
    const result = await Array.fromAsync(
      source
        .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
        .pipeThrough(new SACToCSVTextTransformStream({ summarize: "document" })),
    );
    expect(result.join("")).toBe(input);
  });

  it("errors on invalid event sequences", async () => {
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ name: "column", value: "x" } as const);
        controller.close();
      },
    });
    const stream = source.pipeThrough(new SACToCSVTextTransformStream());
    await expect(Array.fromAsync(stream)).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
  });
});
