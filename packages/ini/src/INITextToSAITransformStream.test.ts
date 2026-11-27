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

  it("handles 1-character chunks and split CRLF line endings", async () => {
    const ini = "\uFEFF; header\r\n[sec]\r\na = 1\r\nb = \"hello\\nworld\"\r\n";
    const events = await parseINI([...ini], { comments: true });
    expect(events).toEqual([
      { name: "startDocument", kind: "ini" },
      { name: "comment", comment: " header", prefix: ";" },
      { name: "section", section: "sec" },
      { name: "entry", key: "a", value: "1" },
      { name: "entry", key: "b", value: "hello\nworld" },
      { name: "endDocument" },
    ]);
  });

  it("preserves comment prefix for ; and #", async () => {
    const ini = "; semi comment\n# hash comment\n[sec] ; section comment\na = 'lit' # quoted comment\n";
    const events = await parseINI(ini, { comments: true });
    expect(events).toEqual([
      { name: "startDocument", kind: "ini" },
      { name: "comment", comment: " semi comment", prefix: ";" },
      { name: "comment", comment: " hash comment", prefix: "#" },
      { name: "section", section: "sec" },
      { name: "comment", comment: " section comment", prefix: ";" },
      { name: "entry", key: "a", value: "lit" },
      { name: "comment", comment: " quoted comment", prefix: "#" },
      { name: "endDocument" },
    ]);
  });

  it("supports custom delimiters via option (default is = only)", async () => {
    await expect(parseINI("key: value\n")).rejects.toThrow(streams.INITextToSAIParserError);

    const events = await parseINI("a: 1\nb = 2\n", { delimiters: ["=", ":"] });
    expect(events).toEqual([
      { name: "startDocument", kind: "ini" },
      { name: "entry", key: "a", value: "1" },
      { name: "entry", key: "b", value: "2" },
      { name: "endDocument" },
    ]);
  });

  it("handles inlineComments option safely", async () => {
    const ini = "url = https://example.com#frag ; trailing\n";
    const defaultEvents = await parseINI(ini, { skipDocument: true });
    expect(defaultEvents).toEqual([
      { name: "entry", key: "url", value: "https://example.com#frag ; trailing" },
    ]);

    const inlineEvents = await parseINI("a = 1 ; note\n", {
      skipDocument: true,
      inlineComments: true,
      comments: true,
    });
    expect(inlineEvents).toEqual([
      { name: "entry", key: "a", value: "1" },
      { name: "comment", comment: " note", prefix: ";" },
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

  it("supports INITextToSAIEventWritableStream callbacks", async () => {
    const seen: string[] = [];
    await from(["[app]\nname = demo\n"]).pipeTo(
      new INITextToSAIEventWritableStream({
        onSection: ({ section }) => seen.push(`section:${section}`),
        onEntry: ({ key, value }) => seen.push(`${key}=${value}`),
      }),
    );
    expect(seen).toEqual(["section:app", "name=demo"]);
  });

  it("reports syntax errors for malformed INI", async () => {
    await expect(parseINI("[unterminated\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("[]\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("[sec] garbage\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("= value\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("k = \"unterminated\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("k = 'unterminated\n")).rejects.toThrow(streams.INITextToSAIParserError);
    await expect(parseINI("k = \"ok\" extra\n")).rejects.toThrow(streams.INITextToSAIParserError);
  });
});
