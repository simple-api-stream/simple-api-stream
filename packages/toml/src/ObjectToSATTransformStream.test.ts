import { describe, expect, it } from "vitest";
import {
  ObjectToSATTransformStream,
  SATToObjectTransformStream,
  SATToTOMLTextTransformStream,
  TOMLTextToSATTransformStream,
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

describe("ObjectToSATTransformStream", () => {
  it("converts nested objects, arrays, array-of-tables, numbers, booleans, and Dates into SAT events", async () => {
    interface Config {
      title: string
      enabled: boolean
      count: number
      ratio: number
      negZero: number
      createdAt: Date
      tags: string[]
      mixed: unknown[]
      emptyArr: unknown[]
      database: {
        host: string
        port: number
      }
      products: {
        name: string
        sku: number
      }[]
    }

    const config: Config = {
      title: "App",
      enabled: true,
      count: 42,
      ratio: 3.14,
      negZero: -0,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      tags: ["a", "b"],
      mixed: [1, { inline: "yes", ignored: undefined }],
      emptyArr: [],
      database: {
        host: "localhost",
        port: 5432,
      },
      products: [
        { name: "Hammer", sku: 1 },
        { name: "Nail", sku: 2 },
      ],
    };

    const tomlText = (await Array.fromAsync(
      fromIterable([config])
        .pipeThrough(new ObjectToSATTransformStream())
        .pipeThrough(new SATToTOMLTextTransformStream({ summarize: "document" })),
    )).join("");

    // Round-trip back through parser and SATToObjectTransformStream
    const [reparsed] = await Array.fromAsync(
      fromIterable([tomlText])
        .pipeThrough(new TOMLTextToSATTransformStream())
        .pipeThrough(new SATToObjectTransformStream()),
    );

    expect(reparsed).toEqual({
      title: "App",
      enabled: true,
      count: 42,
      ratio: 3.14,
      negZero: -0,
      createdAt: "2026-01-02T03:04:05.000Z",
      tags: ["a", "b"],
      mixed: [1, { inline: "yes" }],
      emptyArr: [],
      database: {
        host: "localhost",
        port: 5432,
      },
      products: [
        { name: "Hammer", sku: 1 },
        { name: "Nail", sku: 2 },
      ],
    });
  });

  it("supports makeDocument: false and unSupported options (ignore, error, custom)", async () => {
    const ignoreStream = new ObjectToSATTransformStream({ makeDocument: false });
    expect(ignoreStream.status).toEqual({
      makeDocument: false,
      unSupported: ["ignore", ObjectToSATTransformStream.skip],
    });

    const events = await Array.fromAsync(
      fromIterable([{
        keep: "ok",
        nul: null,
        undef: undefined,
        badDate: new Date(Number.NaN),
        arr: [1, null, 2],
      }]).pipeThrough(ignoreStream),
    );
    expect(events).toEqual([
      { name: "key", path: ["keep"] },
      { name: "value", type: "string", value: "ok" },
      { name: "key", path: ["arr"] },
      { name: "startArray" },
      { name: "value", type: "integer", value: 1 },
      { name: "value", type: "integer", value: 2 },
      { name: "endArray" },
    ]);

    // Custom unSupported handler (replacing and skipping)
    const customHandler = ({ value, skip }: { value: unknown, skip: typeof ObjectToSATTransformStream.skip }) => {
      if (value === null) return "NULL";
      if (value instanceof Date) return "INVALID_DATE";
      return skip;
    };
    const customStream = new ObjectToSATTransformStream({ makeDocument: false, unSupported: customHandler });
    expect(customStream.status.unSupported).toEqual(["custom", customHandler]);

    const customEvents = await Array.fromAsync(
      fromIterable([{
        a: null,
        b: undefined,
        c: new Date(Number.NaN),
      }]).pipeThrough(customStream),
    );
    expect(customEvents).toEqual([
      { name: "key", path: ["a"] },
      { name: "value", type: "string", value: "NULL" },
      { name: "key", path: ["c"] },
      { name: "value", type: "string", value: "INVALID_DATE" },
    ]);

    // unSupported: "error"
    const errorStream = new ObjectToSATTransformStream({ unSupported: "error" });
    expect(errorStream.status.unSupported).toEqual(["error", ObjectToSATTransformStream.unSupportedToError]);
    await expect(
      Array.fromAsync(fromIterable([{ a: null }]).pipeThrough(errorStream)),
    ).rejects.toThrow(streams.ObjectToSATTransformStreamError);

    // unSupported handler returning another unsupported value
    await expect(
      Array.fromAsync(
        fromIterable([{ a: null }]).pipeThrough(new ObjectToSATTransformStream({
          unSupported: () => undefined,
        })),
      ),
    ).rejects.toThrow(streams.ObjectToSATTransformStreamError);
  });

  it("errors on non-object root and circular references", async () => {
    await expect(
      Array.fromAsync(fromIterable([null]).pipeThrough(new ObjectToSATTransformStream())),
    ).rejects.toThrow(streams.ObjectToSATTransformStreamError);

    await expect(
      Array.fromAsync(fromIterable([[1, 2]]).pipeThrough(new ObjectToSATTransformStream())),
    ).rejects.toThrow(streams.ObjectToSATTransformStreamError);

    const cyclicTable: Record<string, unknown> = {};
    cyclicTable.self = cyclicTable;
    await expect(
      Array.fromAsync(fromIterable([cyclicTable]).pipeThrough(new ObjectToSATTransformStream())),
    ).rejects.toThrow(streams.ObjectToSATTransformStreamError);

    const cyclicArr: unknown[] = [];
    cyclicArr.push(cyclicArr);
    await expect(
      Array.fromAsync(fromIterable([{ arr: cyclicArr }]).pipeThrough(new ObjectToSATTransformStream())),
    ).rejects.toThrow(streams.ObjectToSATTransformStreamError);
  });
});
