import { SAJToObjectTransformStream, type eventInterfaces } from "@simple-api-stream/json";
import type { SACEventInterface } from "../event-interface/index.js";
import {
  ObjectToSACTransformStream,
  type ObjectToSACValueFormatter,
} from "../ObjectToSACTransformStream.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

/**
 * Header mode for `SAJToSACTransformStream`.
 */
export type SAJToSACHeaderOption = "auto" | boolean | readonly string[];

/**
 * Configuration options for `SAJToSACTransformStream`.
 */
export type SAJToSACTransformStreamOptions = {
  /** Wrap the emitted SAC events in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /**
   * Header configuration:
   * - `"auto"` (default): infer headers from the first object row's keys; omit headers for array rows
   * - `readonly string[]`: explicit column order and header names
   * - `true` / `false`: explicitly enable or disable header inference
   */
  header?: SAJToSACHeaderOption
  /** Whether to emit a `startHeaderRow`..`endHeaderRow` sequence when headers are available. */
  emitHeader?: boolean
  /** Custom cell value formatter forwarded to `ObjectToSACTransformStream`. */
  formatValue?: ObjectToSACValueFormatter
};

/**
 * A `TransformStream` that converts SAJ (Simple API for JSON) events (either a top-level JSON array of rows
 * or multiple top-level JSON row documents such as NDJSON) into SAC (Simple API for CSV) events,
 * streaming top-level arrays one row at a time.
 */
export class SAJToSACTransformStream extends TransformStream<SAJEventInterface, SACEventInterface> {
  constructor(options?: SAJToSACTransformStreamOptions) {
    const makeDocument = options?.makeDocument ?? true;
    const headerOption = options?.header ?? "auto";
    const emitHeader = options?.emitHeader;
    const formatValue = options?.formatValue;

    const sajToObj = new SAJToObjectTransformStream<unknown>({ multiple: true });
    const rowWriter = sajToObj.writable.getWriter();
    const rowReader = sajToObj.readable.getReader();

    let controller_!: TransformStreamDefaultController<SACEventInterface>;
    type SacPipeline = {
      writer: WritableStreamDefaultWriter<unknown>
      pump: Promise<void>
    };

    const createObjToSac = (resolvedHeader: boolean | readonly string[]): SacPipeline => {
      const objToSac = new ObjectToSACTransformStream({
        makeDocument,
        header: resolvedHeader,
        emitHeader,
        formatValue,
      });
      const writer = objToSac.writable.getWriter();
      const sacReader = objToSac.readable.getReader();
      const pump = (async () => {
        while (true) {
          const { done, value } = await sacReader.read();
          if (done) break;
          controller_.enqueue(value);
        }
      })();
      pump.catch(() => {});
      return { writer, pump };
    };

    const rowPump = (async () => {
      let sacPipeline: SacPipeline | null = headerOption !== "auto" ? createObjToSac(headerOption) : null;
      while (true) {
        const { done, value } = await rowReader.read();
        if (done) break;
        sacPipeline ??= createObjToSac(
          typeof value === "object" && value !== null && !Array.isArray(value),
        );
        await sacPipeline.writer.write(value);
      }
      if (sacPipeline) {
        await sacPipeline.writer.close();
        await sacPipeline.pump;
      }
    })();
    rowPump.catch(() => {});

    let depth = 0;
    let inTopArray = false;

    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: async (chunk) => {
        if (chunk.name === "comment") {
          return;
        }
        if (chunk.name === "startDocument" || chunk.name === "endDocument") {
          return;
        }
        if (depth === 0 && !inTopArray && chunk.name === "startArray") {
          inTopArray = true;
          return;
        }
        if (depth === 0 && inTopArray && chunk.name === "endArray") {
          inTopArray = false;
          return;
        }
        if (chunk.name === "startObject" || chunk.name === "startArray") {
          depth++;
        }
        else if (chunk.name === "endObject" || chunk.name === "endArray") {
          depth--;
        }
        await rowWriter.write(chunk);
      },
      flush: async () => {
        await rowWriter.close();
        await rowPump;
      },
    });
  }
}
