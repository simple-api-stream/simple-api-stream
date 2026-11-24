import { describe, expect, it } from "vitest";
import { CSVTextToSACTransformStream, streams } from "./index.js";

function fromChunks(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function parseCSV(chunks: string[], options?: ConstructorParameters<typeof CSVTextToSACTransformStream>[0]) {
  const stream = fromChunks(chunks).pipeThrough(new CSVTextToSACTransformStream(options));
  return await Array.fromAsync(stream);
}

describe("CSVTextToSACTransformStream", () => {
  it("parses basic CSV with default options (header: false)", async () => {
    const events = await parseCSV(["a,b,c\r\n1,2,3\n"]);
    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "startRecordRow" },
      { name: "column", value: "a", index: 0, quoted: false },
      { name: "column", value: "b", index: 1, quoted: false },
      { name: "column", value: "c", index: 2, quoted: false },
      { name: "endRecordRow" },
      { name: "startRecordRow" },
      { name: "column", value: "1", index: 0, quoted: false },
      { name: "column", value: "2", index: 1, quoted: false },
      { name: "column", value: "3", index: 2, quoted: false },
      { name: "endRecordRow" },
      { name: "endDocument" },
    ]);
  });

  it("parses header row and attaches header names when header: true", async () => {
    const events = await parseCSV(["id,name\n1,Alice\n2,Bob,extra"], { header: true });
    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "startHeaderRow" },
      { name: "column", value: "id", index: 0, quoted: false },
      { name: "column", value: "name", index: 1, quoted: false },
      { name: "endHeaderRow" },
      { name: "startRecordRow" },
      { name: "column", value: "1", index: 0, header: "id", quoted: false },
      { name: "column", value: "Alice", index: 1, header: "name", quoted: false },
      { name: "endRecordRow" },
      { name: "startRecordRow" },
      { name: "column", value: "2", index: 0, header: "id", quoted: false },
      { name: "column", value: "Bob", index: 1, header: "name", quoted: false },
      { name: "column", value: "extra", index: 2, quoted: false },
      { name: "endRecordRow" },
      { name: "endDocument" },
    ]);
  });

  it("supports external header array", async () => {
    const events = await parseCSV(["1,Alice\n"], { header: ["id", "name"] });
    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "startHeaderRow" },
      { name: "column", value: "id", index: 0, quoted: false },
      { name: "column", value: "name", index: 1, quoted: false },
      { name: "endHeaderRow" },
      { name: "startRecordRow" },
      { name: "column", value: "1", index: 0, header: "id", quoted: false },
      { name: "column", value: "Alice", index: 1, header: "name", quoted: false },
      { name: "endRecordRow" },
      { name: "endDocument" },
    ]);
  });

  it("handles quoted fields, escaped quotes, and multiline values across 1-char chunks", async () => {
    const input = "\"a,b\",\"c\"\"d\",\"line1\r\nline2\"\r\n\"\",";
    const events = await parseCSV([...input]);
    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "startRecordRow" },
      { name: "column", value: "a,b", index: 0, quoted: true },
      { name: "column", value: "c\"d", index: 1, quoted: true },
      { name: "column", value: "line1\r\nline2", index: 2, quoted: true },
      { name: "endRecordRow" },
      { name: "startRecordRow" },
      { name: "column", value: "", index: 0, quoted: true },
      { name: "column", value: "", index: 1, quoted: false },
      { name: "endRecordRow" },
      { name: "endDocument" },
    ]);
  });

  it("strips UTF-8 BOM by default and supports skipDocument / skipEmptyLines / custom delimiter", async () => {
    const events = await parseCSV(["\uFEFF", "a\tb\n\n1\t2\r\n"], {
      delimiter: "\t",
      skipDocument: true,
      skipEmptyLines: true,
    });
    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startRecordRow" },
      { name: "column", value: "a", index: 0, quoted: false },
      { name: "column", value: "b", index: 1, quoted: false },
      { name: "endRecordRow" },
      { name: "startRecordRow" },
      { name: "column", value: "1", index: 0, quoted: false },
      { name: "column", value: "2", index: 1, quoted: false },
      { name: "endRecordRow" },
    ]);
  });

  it("handles empty input", async () => {
    const events = await parseCSV([]);
    expect(events.map(e => ({ ...e }))).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "endDocument" },
    ]);
  });

  it("errors on unclosed quote", async () => {
    await expect(parseCSV(["\"unclosed"])).rejects.toThrow(streams.CSVTextToSACParserError);
  });

  it("errors on quote in unquoted field", async () => {
    await expect(parseCSV(["abc\"def"])).rejects.toThrow(streams.CSVTextToSACParserError);
  });

  it("errors on unexpected character after closing quote", async () => {
    await expect(parseCSV(["\"abc\"x"])).rejects.toThrow(streams.CSVTextToSACParserError);
  });

  it("errors on invalid delimiter or quote option", () => {
    expect(() => new CSVTextToSACTransformStream({ delimiter: "" })).toThrow(streams.CSVTextToSACParserError);
    expect(() => new CSVTextToSACTransformStream({ quote: "," })).toThrow(streams.CSVTextToSACParserError);
  });

  it("handles empty lines, standalone CR, trailing commas, quoted EOF/LF, status, and parser edge cases", async () => {
    // Empty lines with skipEmptyLines: false (LF, CRLF, CR) and skipEmptyLines: true (CR)
    const emptyDefault = await parseCSV(["\n\r\na,,\r\nb,\nc\r", "d\r"]);
    expect(emptyDefault.filter(e => e.name === "startRecordRow").length).toBe(6);

    const emptySkipCr = await parseCSV(["\r\na\r\n"], { skipEmptyLines: true });
    expect(emptySkipCr.filter(e => e.name === "startRecordRow").length).toBe(1);

    // Quoted field ending at LF and at EOF
    const quotedEnd = await parseCSV(["\"a\"\n\"b\""]);
    expect(quotedEnd.filter(e => e.name === "column").map(e => e.value)).toEqual(["a", "b"]);

    // TransformStream status getter and empty chunk
    const transform = new CSVTextToSACTransformStream();
    expect(transform.status.pos).toBe(0);
    const out = await Array.fromAsync(fromChunks(["", "x\n"]).pipeThrough(transform));
    expect(out.some(e => e.name === "column" && e.value === "x")).toBe(true);

    // Direct parser: idempotent flush, enqueue after flush, and handler throwing Error
    const parser = new streams.CSVTextToSACParser({ handler: {} });
    parser.enqueue("a\n");
    parser.flush();
    parser.flush();
    expect(() => parser.enqueue("b\n")).toThrow(streams.CSVTextToSACParserError);

    const errParser = new streams.CSVTextToSACParser({
      handler: {
        onColumn: () => {
          throw new Error("column boom");
        },
      },
    });
    expect(() => errParser.enqueue("a\n")).toThrow(/column boom/);
  });
});
