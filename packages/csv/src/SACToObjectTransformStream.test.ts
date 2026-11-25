import { describe, expect, expectTypeOf, it } from "vitest";
import {
  CSVTextToSACTransformStream,
  ResolveToSACReadableStream,
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

describe("SACToObjectTransformStream", () => {
  it("converts headered CSV rows into Record<string, string> by default", async () => {
    const csv = "id,name,note\r\n1,Alice,\"hello, world\"\r\n2,Bob,\r\n";
    const out = fromIterable([csv])
      .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
      .pipeThrough(new SACToObjectTransformStream());

    expectTypeOf(out).toEqualTypeOf<ReadableStream<Record<string, string>>>();

    const rows = await Array.fromAsync(out);
    expect(rows).toEqual([
      { id: "1", name: "Alice", note: "hello, world" },
      { id: "2", name: "Bob", note: "" },
    ]);
  });

  it("falls back to column index keys when no header is present", async () => {
    const csv = "a,b\n1,2\n";
    const rows = await Array.fromAsync(
      fromIterable([csv])
        .pipeThrough(new CSVTextToSACTransformStream())
        .pipeThrough(new SACToObjectTransformStream()),
    );
    expect(rows).toEqual([
      { 0: "a", 1: "b" },
      { 0: "1", 1: "2" },
    ]);
  });

  it("supports SACToObjectTransformStream.toArray preset with inferred string[] type", async () => {
    const csv = "id,name\n1,Alice\n2,Bob\n";
    const out = fromIterable([csv])
      .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
      .pipeThrough(new SACToObjectTransformStream({ mapRow: SACToObjectTransformStream.toArray }));

    expectTypeOf(out).toEqualTypeOf<ReadableStream<string[]>>();

    const rows = await Array.fromAsync(out);
    expect(rows).toEqual([
      ["1", "Alice"],
      ["2", "Bob"],
    ]);
  });

  it("supports custom mapRow with column metadata, headers, rowIndex, and skip", async () => {
    const csv = "id,name,active\n1,Alice,true\n2,\"\",false\n3,Charlie,true\n";
    const out = fromIterable([csv])
      .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
      .pipeThrough(new SACToObjectTransformStream({
        mapRow: ({ columns, headers, rowIndex, skip }) => {
          if (columns[1]?.value === "" && columns[1].quoted) return skip;
          return {
            id: Number(columns[0]?.value),
            name: columns[1]?.value ?? "",
            active: columns[2]?.value === "true",
            rowIndex,
            headerCount: headers?.length ?? 0,
          };
        },
      }));

    expectTypeOf(out).toEqualTypeOf<ReadableStream<{
      id: number
      name: string
      active: boolean
      rowIndex: number
      headerCount: number
    }>>();

    const rows = await Array.fromAsync(out);
    expect(rows).toEqual([
      { id: 1, name: "Alice", active: true, rowIndex: 0, headerCount: 3 },
      { id: 3, name: "Charlie", active: true, rowIndex: 2, headerCount: 3 },
    ]);
  });

  it("supports explicit generic type parameter like SAJToObjectTransformStream<T>", async () => {
    type Row = { id: string, name: string };
    const csv = "id,name\n1,Alice\n";
    const out = fromIterable([csv])
      .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
      .pipeThrough(new SACToObjectTransformStream<Row>());

    expectTypeOf(out).toEqualTypeOf<ReadableStream<Row>>();
    expect(await Array.fromAsync(out)).toEqual([{ id: "1", name: "Alice" }]);
  });

  it("prevents prototype pollution for __proto__ header", async () => {
    const csv = "__proto__,safe\npolluted,ok\n";
    const [row] = await Array.fromAsync(
      fromIterable([csv])
        .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
        .pipeThrough(new SACToObjectTransformStream()),
    );
    expect(Object.hasOwn(row, "__proto__")).toBe(true);
    expect(row["__proto__"]).toBe("polluted");
    expect(row.safe).toBe("ok");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("resets headers and rowIndex across multiple documents and works with skipDocument", async () => {
    const source = new ResolveToSACReadableStream();
    const transformer = new SACToObjectTransformStream({
      mapRow: ({ columns, headers, rowIndex }) => ({
        headers,
        rowIndex,
        values: columns.map(c => c.value),
      }),
    });
    const out = source.pipeThrough(transformer);

    source.startDocument();
    source.startHeaderRow();
    source.column("a");
    source.endHeaderRow();
    source.startRecordRow();
    source.column("1");
    source.endRecordRow();
    source.endDocument();

    source.startDocument();
    source.startHeaderRow();
    source.column("b");
    source.endHeaderRow();
    source.startRecordRow();
    source.column("2");
    source.endRecordRow();
    source.endDocument();
    source.close();

    expect(await Array.fromAsync(out)).toEqual([
      { headers: ["a"], rowIndex: 0, values: ["1"] },
      { headers: ["b"], rowIndex: 0, values: ["2"] },
    ]);
    expect(transformer.status).toEqual({
      inDocument: false,
      inRow: null,
      headers: ["b"],
      rowIndex: 1,
    });

    const noDocRows = await Array.fromAsync(
      fromIterable(["x,y\n1,2\n"])
        .pipeThrough(new CSVTextToSACTransformStream({ header: true, skipDocument: true }))
        .pipeThrough(new SACToObjectTransformStream()),
    );
    expect(noDocRows).toEqual([{ x: "1", y: "2" }]);

    // Column without header or index metadata + status before headers
    const plainTransformer = new SACToObjectTransformStream();
    expect(plainTransformer.status.headers).toBeUndefined();
    const manualSource = new ResolveToSACReadableStream();
    const manualOut = manualSource.pipeThrough(plainTransformer);
    manualSource.startRecordRow();
    manualSource.column("only");
    manualSource.endRecordRow();
    manualSource.close();
    expect(await Array.fromAsync(manualOut)).toEqual([{ 0: "only" }]);

    // Column without col.header falls back to collected headers[i], and extra column falls back to index
    const headerFallbackOut = fromIterable([
      { name: "startHeaderRow" as const },
      { name: "column" as const, value: "colA" },
      { name: "endHeaderRow" as const },
      { name: "startRecordRow" as const },
      { name: "column" as const, value: "valA" },
      { name: "column" as const, value: "extra" },
      { name: "endRecordRow" as const },
    ]).pipeThrough(new SACToObjectTransformStream());
    expect(await Array.fromAsync(headerFallbackOut)).toEqual([{ colA: "valA", 1: "extra" }]);
  });

  it("errors on invalid event sequences and mapper errors", async () => {
    const runEvents = async (events: unknown[]) => {
      const source = fromIterable(events);
      await Array.fromAsync(source.pipeThrough(new SACToObjectTransformStream() as TransformStream<unknown, unknown>));
    };

    await expect(runEvents([{ name: "column", value: "x" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }, { name: "startDocument", kind: "csv" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }, { name: "startDocument", kind: "csv" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "endDocument" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }, { name: "startRecordRow" }, { name: "endDocument" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "startHeaderRow" }, { name: "startHeaderRow" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "endHeaderRow" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }, { name: "startRecordRow" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "endRecordRow" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "startRecordRow" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "startDocument", kind: "csv" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);
    await expect(runEvents([{ name: "unknown" }])).rejects.toThrow(streams.SACToObjectTransformStreamError);

    await expect(
      Array.fromAsync(
        fromIterable(["a\n1\n"])
          .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
          .pipeThrough(new SACToObjectTransformStream({
            mapRow: () => {
              throw new Error("boom");
            },
          })),
      ),
    ).rejects.toThrow(streams.SACToObjectTransformStreamError);
  });
});
