import {
  responseToTextStream,
  type ResponseToTextStreamOptions,
} from "@simple-api-stream/core";
import { SATToObjectTransformStream } from "./SATToObjectTransformStream.js";
import { TOMLTextToSATTransformStream } from "./TOMLTextToSATTransformStream.js";

/**
 * Configuration options for `parseTOMLResponse`.
 */
export type ParseTOMLResponseOptions = ResponseToTextStreamOptions & {
  /** Options forwarded to `TOMLTextToSATTransformStream`. */
  parser?: ConstructorParameters<typeof TOMLTextToSATTransformStream>[0]
};

function isTOMLMediaType(mediaType: string | null): boolean {
  if (!mediaType) return false;
  return mediaType === "application/toml" || mediaType === "text/toml";
}

/**
 * Validates a Fetch `Response` (checking `Content-Type` by default) and streams reconstructed TOML table objects of type `T`.
 */
export function parseTOMLResponse<T = Record<string, unknown>>(
  response: Response,
  options?: ParseTOMLResponseOptions,
): ReadableStream<T> {
  return responseToTextStream(response, options, isTOMLMediaType)
    .pipeThrough(new TOMLTextToSATTransformStream(options?.parser))
    .pipeThrough(new SATToObjectTransformStream<T>());
}
