import {
  parseMediaType,
  responseToTextStream,
  type ResponseToTextStreamOptions,
} from "@simple-api-stream/core";
import { CSVTextToSACTransformStream } from "./CSVTextToSACTransformStream.js";
import { SACToObjectTransformStream, type SACToObjectTransformStreamOptions } from "./SACToObjectTransformStream.js";

/**
 * Configuration options for `parseCSVResponse`.
 */
export type ParseCSVResponseOptions<T = Record<string, string>> = ResponseToTextStreamOptions & {
  /** Options forwarded to `CSVTextToSACTransformStream`. */
  parser?: ConstructorParameters<typeof CSVTextToSACTransformStream>[0]
  /** Options forwarded to `SACToObjectTransformStream`. */
  object?: SACToObjectTransformStreamOptions<T>
};

function isCSVMediaType(mediaType: string | null): boolean {
  if (!mediaType) return false;
  return (
    mediaType === "text/csv"
    || mediaType === "application/csv"
    || mediaType === "text/tab-separated-values"
  );
}

/**
 * Validates a Fetch `Response` (checking `Content-Type` by default) and streams reconstructed CSV row objects (or mapped `T` values).
 * Automatically uses `delimiter: "\t"` for `text/tab-separated-values` unless overridden via `options.parser.delimiter`.
 */
export function parseCSVResponse<T = Record<string, string>>(
  response: Response,
  options?: ParseCSVResponseOptions<T>,
): ReadableStream<T> {
  const textStream = responseToTextStream(response, options, isCSVMediaType);
  const mediaType = parseMediaType(response.headers.get("content-type"));

  const parserOptions: ConstructorParameters<typeof CSVTextToSACTransformStream>[0] = { ...options?.parser };
  if (parserOptions.delimiter === undefined && mediaType === "text/tab-separated-values") {
    parserOptions.delimiter = "\t";
  }

  return textStream
    .pipeThrough(new CSVTextToSACTransformStream(parserOptions))
    .pipeThrough(new SACToObjectTransformStream<T>(options?.object));
}
