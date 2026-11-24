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

  it("errors on invalid options and invalid event sequences", async () => {
    expect(() => new SACToCSVTextTransformStream({ delimiter: "" })).toThrow(streams.SACToCSVTextTransformStreamError);
    expect(() => new SACToCSVTextTransformStream({ quote: "," })).toThrow(streams.SACToCSVTextTransformStreamError);

    // summarize: false and empty cell emit + header row summarize: "row"
    const sourceRow = new ResolveToSACReadableStream();
    const rowOut = sourceRow.pipeThrough(new SACToCSVTextTransformStream({ summarize: "row", lineBreak: "\n" }));
    sourceRow.startDocument();
    sourceRow.startHeaderRow();
    sourceRow.column("h1");
    sourceRow.endHeaderRow();
    sourceRow.endDocument();
    sourceRow.close();
    expect(await Array.fromAsync(rowOut)).toEqual(["h1\n"]);

    const sourceEmpty = new ResolveToSACReadableStream();
    const emptyOut = sourceEmpty.pipeThrough(new SACToCSVTextTransformStream({ summarize: false, lineBreak: "\n" }));
    sourceEmpty.startRecordRow();
    sourceEmpty.column("");
    sourceEmpty.endRecordRow();
    sourceEmpty.close();
    expect(await Array.fromAsync(emptyOut)).toEqual(["\n"]);

    const runEvents = async (events: unknown[]) => {
      const source = new ReadableStream({
        start(controller) {
          for (const e of events) controller.enqueue(e);
          controller.close();
        },
      });
      await Array.fromAsync(source.pipeThrough(new SACToCSVTextTransformStream()));
    };

    await expect(runEvents([{ name: "column", value: "x" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }, { name: "startDocument", kind: "csv" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }, { name: "startDocument", kind: "csv" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "endDocument" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }, { name: "startRecordRow" }, { name: "endDocument" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }, { name: "startHeaderRow" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "endHeaderRow" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }, { name: "startRecordRow" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "endRecordRow" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "unknown" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }])).rejects.toThrow(streams.SACToCSVTextTransformStreamError);
  });
});
