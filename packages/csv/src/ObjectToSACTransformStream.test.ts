import { describe, expect, expectTypeOf, it } from "vitest";
import {
  CSVTextToSACTransformStream,
  ObjectToSACTransformStream,
  SACToCSVTextTransformStream,
  SACToObjectTransformStream,
  streams,
} from "./index.js";

function fromIterable<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("ObjectToSACTransformStream", () => {
  it("converts objects with header: true into SAC events", async () => {
    interface User {
      id: number
      name: string
      note?: string | null
    }

    const users: User[] = [
      { id: 1, name: "Alice", note: null },
      { id: 2, name: "Bob", note: "hi" },
    ];

    const out = fromIterable(users)
      .pipeThrough(new ObjectToSACTransformStream({ header: true }));

    const events = await Array.fromAsync(out);
    expect(events).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "startHeaderRow" },
      { name: "column", value: "id", index: 0 },
      { name: "column", value: "name", index: 1 },
      { name: "column", value: "note", index: 2 },
      { name: "endHeaderRow" },
      { name: "startRecordRow" },
      { name: "column", value: "1", index: 0, header: "id" },
      { name: "column", value: "Alice", index: 1, header: "name" },
      { name: "column", value: "", index: 2, header: "note" },
      { name: "endRecordRow" },
      { name: "startRecordRow" },
      { name: "column", value: "2", index: 0, header: "id" },
      { name: "column", value: "Bob", index: 1, header: "name" },
      { name: "column", value: "hi", index: 2, header: "note" },
      { name: "endRecordRow" },
      { name: "endDocument" },
    ]);
  });

  it("supports explicit header order and emitHeader: false", async () => {
    const rows = [
      { b: "2", a: "1" },
      { a: "3", b: "4" },
    ];
    const csv = (await Array.fromAsync(
      fromIterable(rows)
        .pipeThrough(new ObjectToSACTransformStream({ header: ["a", "b"], emitHeader: false }))
        .pipeThrough(new SACToCSVTextTransformStream({ lineBreak: "\n", summarize: "document" })),
    )).join("");

    expect(csv).toBe("1,2\n3,4\n");
  });

  it("emits header-only document when explicit header is set and no rows arrive", async () => {
    const events = await Array.fromAsync(
      fromIterable<Record<string, unknown>>([])
        .pipeThrough(new ObjectToSACTransformStream({ header: ["id", "name"] })),
    );
    expect(events).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "startHeaderRow" },
      { name: "column", value: "id", index: 0 },
      { name: "column", value: "name", index: 1 },
      { name: "endHeaderRow" },
      { name: "endDocument" },
    ]);
  });

  it("converts arrays and iterables into SAC events", async () => {
    const rows: Iterable<unknown>[] = [
      ["1", "Alice"],
      new Set(["2", "Bob"]),
    ];
    const events = await Array.fromAsync(
      fromIterable(rows)
        .pipeThrough(new ObjectToSACTransformStream({ makeDocument: false })),
    );
    expect(events).toEqual([
      { name: "startRecordRow" },
      { name: "column", value: "1", index: 0 },
      { name: "column", value: "Alice", index: 1 },
      { name: "endRecordRow" },
      { name: "startRecordRow" },
      { name: "column", value: "2", index: 0 },
      { name: "column", value: "Bob", index: 1 },
      { name: "endRecordRow" },
    ]);
  });

  it("supports custom mapRow with inferred input type, column metadata, and skip", async () => {
    type Item = { id: number, label: string, hidden?: boolean };
    const transformer = new ObjectToSACTransformStream({
      header: ["id", "label"] as const,
      mapRow: (item: Item, { skip }) => {
        if (item.hidden) return skip;
        return [
          String(item.id),
          { value: item.label, quoted: true },
        ];
      },
    });

    expectTypeOf(transformer).toEqualTypeOf<ObjectToSACTransformStream<Item>>();

    const events = await Array.fromAsync(
      fromIterable<Item>([
        { id: 1, label: "first" },
        { id: 2, label: "ignored", hidden: true },
        { id: 3, label: "third" },
      ]).pipeThrough(transformer),
    );

    expect(events).toEqual([
      { name: "startDocument", kind: "csv" },
      { name: "startHeaderRow" },
      { name: "column", value: "id", index: 0 },
      { name: "column", value: "label", index: 1 },
      { name: "endHeaderRow" },
      { name: "startRecordRow" },
      { name: "column", value: "1", index: 0, header: "id" },
      { name: "column", value: "first", index: 1, header: "label", quoted: true },
      { name: "endRecordRow" },
      { name: "startRecordRow" },
      { name: "column", value: "3", index: 0, header: "id" },
      { name: "column", value: "third", index: 1, header: "label", quoted: true },
      { name: "endRecordRow" },
      { name: "endDocument" },
    ]);
    expect(transformer.status).toEqual({
      makeDocument: true,
      headers: ["id", "label"],
      rowIndex: 2,
      documentStarted: true,
      headerEmitted: true,
    });
  });

  it("supports formatValue and object rows without header", async () => {
    const csv = (await Array.fromAsync(
      fromIterable([{ a: 1, b: true }, { b: false, a: 2 }])
        .pipeThrough(new ObjectToSACTransformStream({
          formatValue: v => typeof v === "boolean" ? (v ? "YES" : "NO") : String(v as number),
        }))
        .pipeThrough(new SACToCSVTextTransformStream({ lineBreak: "\n", summarize: "document" })),
    )).join("");

    expect(csv).toBe("1,YES\n2,NO\n");
  });

  it("formats primitive, symbol, Date, object, and function values with defaultFormatValue", async () => {
    const date = new Date("2026-01-02T03:04:05.000Z");
    const transformer = new ObjectToSACTransformStream({ makeDocument: false });
    expect(transformer.status.headers).toBeUndefined();

    const events = await Array.fromAsync(
      fromIterable([[
        null,
        undefined,
        "text",
        42,
        true,
        10n,
        Symbol("sym"),
        date,
        { nested: 1 },
        () => {},
      ]]).pipeThrough(transformer),
    );

    expect(events).toEqual([
      { name: "startRecordRow" },
      { name: "column", value: "", index: 0 },
      { name: "column", value: "", index: 1 },
      { name: "column", value: "text", index: 2 },
      { name: "column", value: "42", index: 3 },
      { name: "column", value: "true", index: 4 },
      { name: "column", value: "10", index: 5 },
      { name: "column", value: "Symbol(sym)", index: 6 },
      { name: "column", value: "2026-01-02T03:04:05.000Z", index: 7 },
      { name: "column", value: "{\"nested\":1}", index: 8 },
      { name: "column", value: "", index: 9 },
      { name: "endRecordRow" },
    ]);

    // mapRow without headers + explicit column header override
    const mappedEvents = await Array.fromAsync(
      fromIterable(["row"]).pipeThrough(new ObjectToSACTransformStream({
        makeDocument: false,
        mapRow: (v: string, { headers }) => [
          { value: v, header: headers ? headers[0] : "custom", quoted: false },
        ],
      })),
    );
    expect(mappedEvents).toEqual([
      { name: "startRecordRow" },
      { name: "column", value: "row", index: 0, header: "custom", quoted: false },
      { name: "endRecordRow" },
    ]);
  });

  it("round-trips CSV text -> SAC -> Object -> SAC -> CSV text", async () => {
    const input = "id,name,note\r\n1,Alice,\"a, b\"\r\n2,Bob,\"line1\r\nline2\"\r\n";
    const output = (await Array.fromAsync(
      fromIterable([input])
        .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
        .pipeThrough(new SACToObjectTransformStream())
        .pipeThrough(new ObjectToSACTransformStream({ header: true }))
        .pipeThrough(new SACToCSVTextTransformStream({ summarize: "document" })),
    )).join("");

    expect(output).toBe(input);
  });

  it("errors on unsupported row values and mapper errors", async () => {
    await expect(
      Array.fromAsync(
        fromIterable(["not-an-object"])
          .pipeThrough(new ObjectToSACTransformStream()),
      ),
    ).rejects.toThrow(streams.ObjectToSACTransformStreamError);

    await expect(
      Array.fromAsync(
        fromIterable([{ a: 1 }])
          .pipeThrough(new ObjectToSACTransformStream({
            mapRow: () => {
              throw new Error("mapper failed");
            },
          })),
      ),
    ).rejects.toThrow(streams.ObjectToSACTransformStreamError);
  });
});
