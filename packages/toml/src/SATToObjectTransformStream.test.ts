import { describe, expect, test } from "vitest";
import { ResolveToSATReadableStream, SATToObjectTransformStream, TOMLTextToSATTransformStream } from "./index.js";
import type { SATEventInterface } from "./event-interface/index.js";

async function parseToObject<T = Record<string, unknown>>(toml: string): Promise<T[]> {
  const readable = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(toml);
      controller.close();
    },
  });
  const results: T[] = [];
  await readable
    .pipeThrough(new TOMLTextToSATTransformStream({ comments: true }))
    .pipeThrough(new SATToObjectTransformStream<T>())
    .pipeTo(new WritableStream({
      write(obj) {
        results.push(obj);
      },
    }));
  return results;
}

async function runEventsToObject(events: SATEventInterface[]): Promise<Record<string, unknown>[]> {
  const readable = new ReadableStream<SATEventInterface>({
    start(controller) {
      for (const e of events) controller.enqueue(e);
      controller.close();
    },
  });
  const stream = new SATToObjectTransformStream();
  expect(stream.status.inDocument).toBe(false);
  const results: Record<string, unknown>[] = [];
  await readable.pipeThrough(stream).pipeTo(new WritableStream({
    write(obj) {
      results.push(obj);
    },
  }));
  return results;
}

describe("SATToObjectTransformStream", () => {
  test("reconstructs nested tables, dotted keys, inline tables, and array of tables", async () => {
    const toml = `
# comment
title = "Example"
a.b.c = 42
a.b.d = 43

[owner]
name = "Tom"

[database]
ports = [ 8000, 8001 ]
meta = { enabled = true, tag = "v1", sub.x = 1 }

[database.extra]
flag = false

[[products]]
name = "Hammer"
sku = 738594937

[[products]]
name = "Nail"
sku = 284758393

[[products.variants]]
color = "red"
`;
    const [obj] = await parseToObject(toml);
    expect(obj).toEqual({
      title: "Example",
      a: { b: { c: 42, d: 43 } },
      owner: { name: "Tom" },
      database: {
        ports: [8000, 8001],
        meta: { enabled: true, tag: "v1", sub: { x: 1 } },
        extra: { flag: false },
      },
      products: [
        { name: "Hammer", sku: 738594937 },
        { name: "Nail", sku: 284758393, variants: [{ color: "red" }] },
      ],
    });
  });

  test("reconstructs stream without startDocument/endDocument via flush", async () => {
    const stream = new ResolveToSATReadableStream((r) => {
      r.key(["x"]);
      r.value("integer", 10);
    });
    const results: Record<string, unknown>[] = [];
    await stream.pipeThrough(new SATToObjectTransformStream()).pipeTo(new WritableStream({
      write(obj) {
        results.push(obj);
      },
    }));
    expect(results).toEqual([{ x: 10 }]);
  });

  test("rejects invalid key/table conflicts and invalid event sequences", async () => {
    await expect(parseToObject("[parent.child]\nx = 1\n[parent]\ny = 2\n")).resolves.toEqual([{ parent: { child: { x: 1 }, y: 2 } }]);
    await expect(parseToObject("a = 1\na = 2\n")).rejects.toThrow(/Duplicate key/);
    await expect(parseToObject("a = 1\n[a.b]\nx = 1\n")).rejects.toThrow(/non-table/);
    await expect(parseToObject("a = 1\n[a]\nx = 1\n")).rejects.toThrow(/non-table/);
    await expect(parseToObject("a = 1\n[[a]]\nx = 1\n")).rejects.toThrow(/non-array/);
    await expect(parseToObject("[[a]]\nx = 1\n[[a.b]]\ny = 2\n[c]\nz = 3\n")).resolves.toBeDefined();
    await expect(parseToObject("a = 1\na.b = 2\n")).rejects.toThrow(/non-table/);
    await expect(parseToObject("a = [1]\n[a.b]\nx = 1\n")).rejects.toThrow(/non-table array element/);

    await expect(runEventsToObject([{ name: "startDocument", kind: "toml" }, { name: "startDocument", kind: "toml" }])).rejects.toThrow(/already in document/);
    await expect(runEventsToObject([{ name: "endDocument" }])).rejects.toThrow(/outside document/);
    await expect(runEventsToObject([{ name: "startDocument", kind: "toml" }, { name: "key", path: ["a"] }, { name: "endDocument" }])).rejects.toThrow(/unclosed container or pending key/);
    await expect(runEventsToObject([{ name: "key", path: ["a"] }])).rejects.toThrow(/unclosed container or pending key/);
    await expect(runEventsToObject([{ name: "value", type: "integer", value: 1 }])).rejects.toThrow(/Value without key/);
    await expect(runEventsToObject([{ name: "key", path: ["a"] }, { name: "startInlineTable" }, { name: "value", type: "integer", value: 1 }])).rejects.toThrow(/Value without key in inline table/);
    await expect(runEventsToObject([{ name: "endArray" }])).rejects.toThrow(/Unexpected endArray/);
    await expect(runEventsToObject([{ name: "endInlineTable" }])).rejects.toThrow(/Unexpected endInlineTable/);
  });
});
