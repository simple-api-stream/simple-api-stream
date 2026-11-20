import { describe, expect, it, vi } from "vitest";
import { CSVTextToSACEventWritableStream } from "./index.js";

describe("CSVTextToSACEventWritableStream", () => {
  it("invokes handler callbacks for parsed CSV events", async () => {
    const columns: Array<{ index?: number, header?: string, value: string }> = [];
    const onStartDocument = vi.fn();
    const onEndDocument = vi.fn();

    const stream = new CSVTextToSACEventWritableStream(
      {
        onStartDocument,
        onEndDocument,
        onColumn: ({ index, header, value }) => {
          columns.push({ index, header, value });
        },
      },
      { header: true },
    );

    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("id,name\n");
        controller.enqueue("1,Alice\n");
        controller.close();
      },
    });
    await source.pipeTo(stream);

    expect(onStartDocument).toHaveBeenCalledTimes(1);
    expect(onEndDocument).toHaveBeenCalledTimes(1);
    expect(columns).toEqual([
      { index: 0, header: undefined, value: "id" },
      { index: 1, header: undefined, value: "name" },
      { index: 0, header: "id", value: "1" },
      { index: 1, header: "name", value: "Alice" },
    ]);
    expect(stream.status.rowIndex).toBe(1);
  });

  it("calls onError when stream is aborted", async () => {
    const onError = vi.fn();
    const stream = new CSVTextToSACEventWritableStream({ onError });
    const writer = stream.getWriter();
    await writer.abort(new Error("aborted"));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
