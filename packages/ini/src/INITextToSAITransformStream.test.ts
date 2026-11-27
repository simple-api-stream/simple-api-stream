import { describe, expect, it } from "vitest";
import {
  INITextToSAIEventWritableStream,
  INITextToSAITransformStream,
  streams,
  type eventInterfaces,
} from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

async function parseINI(
  input: string | string[],
  options?: ConstructorParameters<typeof INITextToSAITransformStream>[0],
): Promise<eventInterfaces.SAIEventInterface[]> {
  const chunks = typeof input === "string" ? [input] : input;
  const stream = from(chunks).pipeThrough(new INITextToSAITransformStream(options));
  return await Array.fromAsync(stream);
}

describe("INITextToSAITransformStream", () => {
  it("parses sections, entries, and blank lines", async () => {
    const ini = [
      "global = value",
      "",
      "[server]",
      "host = localhost",
      "port = 8080",
      "empty =",
      "",
      "[db.primary]",
      "user = admin",
    ].join("\n");

    const events = await parseINI(ini);
    expect(events).toEqual([
      { name: "startDocument", kind: "ini" },
      { name: "entry", key: "global", value: "value" },
      { name: "section", section: "server" },
      { name: "entry", key: "host", value: "localhost" },
      { name: "entry", key: "port", value: "8080" },
      { name: "entry", key: "empty", value: "" },
      { name: "section", section: "db.primary" },
      { name: "entry", key: "user", value: "admin" },
      { name: "endDocument" },
    ]);
  });

  it("handles 1-character chunks, split CRLF, CR-only, CR at EOF, and double-quoted escapes", async () => {
    const ini = "\uFEFF; header\r\n[sec]\r\na = 1\rb = \"\\r\\t\\0\\\\\\\"\\x\" ; cmt\r";
    const events = await parseINI([...ini], { comments: true });
    expect(events).toEqual([
      { name: "startDocument", kind: "ini" },
      { name: "comment", comment: " header", prefix: ";" },
      { name: "section", section: "sec" },
      { name: "entry", key: "a", value: "1" },
      { name: "entry", key: "b", value: "\r\t\0\\\"x" },
      { name: "comment", comment: " cmt", prefix: ";" },
      { name: "endDocument" },
    ]);
  });

  it("preserves comment prefix for ; and # and omits comments when disabled", async () => {
    const ini = "; semi comment\n# hash comment\n[sec] ; section comment\na = 'lit' # quoted comment\nb = 'plain'\n";
    const events = await parseINI(ini, { comments: true });
    expect(events).toEqual([
      { name: "startDocument", kind: "ini" },
      { name: "comment", comment: " semi comment", prefix: ";" },
      { name: "comment", comment: " hash comment", prefix: "#" },
      { name: "section", section: "sec" },
      { name: "comment", comment: " section comment", prefix: ";" },
      { name: "entry", key: "a", value: "lit" },
      { name: "comment", comment: " quoted comment", prefix: "#" },
      { name: "entry", key: "b", value: "plain" },
      { name: "endDocument" },
    ]);

    const withoutComments = await parseINI(ini, { comments: false, skipDocument: true });
    expect(withoutComments).toEqual([
      { name: "section", section: "sec" },
      { name: "entry", key: "a", value: "lit" },
      { name: "entry", key: "b", value: "plain" },
    ]);
  });

  it("supports custom delimiters via option (default is = only) and longest-match at same index", async () => {
    await expect(parseINI("key: value\n")).rejects.toThrow(streams.INITextToSAIParserError);

    const events = await parseINI("a: 1\nb == 2\nc = 3\n", { delimiters: ["=", "==", ":"] });
    expect(events).toEqual([
      { name: "startDocument", kind: "ini" },
      { name: "entry", key: "a", value: "1" },
      { name: "entry", key: "b", value: "2" },
      { name: "entry", key: "c", value: "3" },
      { name: "endDocument" },
    ]);
  });

  it("handles inlineComments option safely (with and without comment on line)", async () => {
    const ini = "url = https://example.com#frag ; trailing\n";
    const defaultEvents = await parseINI(ini, { skipDocument: true });
    expect(defaultEvents).toEqual([
      { name: "entry", key: "url", value: "https://example.com#frag ; trailing" },
    ]);

    const inlineEvents = await parseINI("a = 1 ; note\nb = plain\n", {
      skipDocument: true,
      inlineComments: true,
      comments: true,
    });
    expect(inlineEvents).toEqual([
      { name: "entry", key: "a", value: "1" },
      { name: "comment", comment: " note", prefix: ";" },
      { name: "entry", key: "b", value: "plain" },
    ]);
  });

  it("preserves duplicate keys and sections as raw events", async () => {
    const ini = "[s]\nk = 1\nk = 2\n[s]\nk = 3\n";
    const events = await parseINI(ini, { skipDocument: true });
    expect(events).toEqual([
      { name: "section", section: "s" },
      { name: "entry", key: "k", value: "1" },
      { name: "entry", key: "k", value: "2" },
      { name: "section", section: "s" },
      { name: "entry", key: "k", value: "3" },
    ]);
  });

  it("supports INITextToSAIEventWritableStream callbacks, status, and abort", async () => {
    const seen: string[] = [];
    const writable = new INITextToSAIEventWritableStream({
      onSection: ({ section }) => seen.push(`section:${section}`),
      onEntry: ({ key, value }) => seen.push(`${key}=${value}`),
    });
    expect(writable.status.eof).toBe(false);
    await from(["[app]\nname = demo\n"]).pipeTo(writable);
    expect(seen).toEqual(["section:app", "name=demo"]);
    expect(writable.status.eof).toBe(true);

    let aborted: unknown;
    const abortable = new INITextToSAIEventWritableStream({
      onError: (err) => {
        aborted = err;
      },
    });
    await abortable.abort("cancelled");
    expect(aborted).toBe("cancelled");
  });

  it("exposes status on TransformStream and Parser, and handles parser edge cases", () => {
    const transform = new INITextToSAITransformStream();
    expect(transform.status.line).toBe(0);

    // Direct parser without options or onError handler
    const defaultParser = new streams.INITextToSAIParser();
    expect(defaultParser.status.eof).toBe(false);
    defaultParser.enqueue("a=1\n");
    defaultParser.flush();
    defaultParser.flush(); // idempotent after eof
    expect(defaultParser.status.eof).toBe(true);

    // Enqueue after flush throws when no onError handler
    expect(() => defaultParser.enqueue("b=2\n")).toThrow(streams.INITextToSAIParserError);
    // Subsequent enqueue after error is a no-op
    defaultParser.enqueue("c=3\n");
    // Flush after error is a no-op
    defaultParser.flush();

    // Non-parser error thrown from handler is wrapped
    let caught: unknown;
    const throwingParser = new streams.INITextToSAIParser({
      handler: {
        onEntry: () => {
          throw new Error("handler boom");
        },
        onError: (e) => {
          caught = e;
        },
      },
    });
    throwingParser.enqueue("a=1\n");
    throwingParser.flush();
    expect(caught).toBeInstanceOf(streams.INITextToSAIParserError);

    // Invalid parser options
    expect(() => new streams.INITextToSAIParser({ commentPrefixes: [""] })).toThrow(streams.INITextToSAIParserError);
    expect(() => new streams.INITextToSAIParser({ delimiters: [] })).toThrow(streams.INITextToSAIParserError);
    expect(() => new streams.INITextToSAIParser({ delimiters: [""] })).toThrow(streams.INITextToSAIParserError);
  });

  it("reports syntax errors for malformed INI", async () => {
    await expect(parseINI("[unterminated\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("[]\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("[sec] garbage\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("= value\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("k = \"unterminated\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("k = \"trailing-backslash\\\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("k = 'unterminated\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("k = \"ok\" extra\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("k = 'ok' extra\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("no-delim-at-eof")).rejects.toThrow(streams.INITextToSAIParserError);
  });
});
