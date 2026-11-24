import {
  parseMediaType,
  responseToTextStream,
  type ResponseToTextStreamOptions,
} from "@simple-api-stream/core";
import { JSONTextToSAJTransformStream } from "./JSONTextToSAJTransformStream.js";
import { SAJToObjectTransformStream, type SAJToObjectTransformStreamOptions } from "./SAJToObjectTransformStream.js";

/**
 * Configuration options for `parseJSONResponse`.
 */
export type ParseJSONResponseOptions = ResponseToTextStreamOptions & {
  /** Options forwarded to `JSONTextToSAJTransformStream`. */
  parser?: ConstructorParameters<typeof JSONTextToSAJTransformStream>[0]
  /** Options forwarded to `SAJToObjectTransformStream`. */
  object?: Partial<SAJToObjectTransformStreamOptions>
};

function isJsonSeqMediaType(mediaType: string): boolean {
  return mediaType === "application/json-seq" || mediaType.endsWith("+json-seq");
}

const NDJSON_MEDIA_TYPES = new Set([
  "application/x-ndjson",
  "application/ndjson",
  "application/x-nd-json",
  "application/nd-json",
  "application/jsonl",
  "application/x-jsonl",
  "application/jsonlines",
  "application/json-lines",
]);

function isNdjsonMediaType(mediaType: string): boolean {
  return NDJSON_MEDIA_TYPES.has(mediaType) || mediaType.endsWith("+ndjson") || mediaType.endsWith("+jsonl");
}

function isJSONMediaType(mediaType: string | null): boolean {
  if (!mediaType) return false;
  return (
    mediaType === "application/json"
    || mediaType === "text/json"
    || mediaType.endsWith("+json")
    || isJsonSeqMediaType(mediaType)
    || isNdjsonMediaType(mediaType)
  );
}

/**
 * Validates a Fetch `Response` (checking `Content-Type` by default) and streams parsed JavaScript values of type `T`.
 * Automatically enables `multiple: "json-seq"` for `application/json-seq` / `*+json-seq` and `multiple: true` for
 * NDJSON/JSONL media types unless overridden via `options.parser.multiple`.
 */
export function parseJSONResponse<T = unknown>(
  response: Response,
  options?: ParseJSONResponseOptions,
): ReadableStream<T> {
  const textStream = responseToTextStream(response, options, isJSONMediaType);
  const mediaType = parseMediaType(response.headers.get("content-type"));

  const baseParser = options?.parser;
  let parserOptions: ConstructorParameters<typeof JSONTextToSAJTransformStream>[0];
  if (baseParser?.multiple !== undefined) {
    parserOptions = baseParser;
  }
  else if (mediaType && isJsonSeqMediaType(mediaType)) {
    parserOptions = { ...baseParser, multiple: "json-seq" };
  }
  else if (mediaType && isNdjsonMediaType(mediaType)) {
    parserOptions = { ...baseParser, multiple: true };
  }
  else {
    parserOptions = baseParser;
  }

  const objectOptions: Partial<SAJToObjectTransformStreamOptions> = {
    multiple: options?.object?.multiple ?? Boolean(parserOptions?.multiple),
  };

  return textStream
    .pipeThrough(new JSONTextToSAJTransformStream(parserOptions))
    .pipeThrough(new SAJToObjectTransformStream<T>(objectOptions));
}
