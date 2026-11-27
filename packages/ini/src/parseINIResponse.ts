import {
  responseToTextStream,
  type ResponseToTextStreamOptions,
} from "@simple-api-stream/core";
import { INITextToSAITransformStream } from "./INITextToSAITransformStream.js";
import { SAIToObjectTransformStream, type INIObject } from "./SAIToObjectTransformStream.js";

/**
 * Configuration options for `parseINIResponse`.
 */
export type ParseINIResponseOptions = ResponseToTextStreamOptions & {
  /** Options forwarded to `INITextToSAITransformStream`. */
  parser?: ConstructorParameters<typeof INITextToSAITransformStream>[0]
};

const INI_MEDIA_TYPES = new Set([
  "text/plain",
  "text/ini",
  "text/x-ini",
  "application/ini",
  "application/x-ini",
]);

function isINIMediaType(mediaType: string | null): boolean {
  if (!mediaType) return false;
  return INI_MEDIA_TYPES.has(mediaType);
}

/**
 * Validates a Fetch `Response` (checking `Content-Type` by default) and streams reconstructed INI objects of type `T`.
 */
export function parseINIResponse<T = INIObject>(
  response: Response,
  options?: ParseINIResponseOptions,
): ReadableStream<T> {
  return responseToTextStream(response, options, isINIMediaType)
    .pipeThrough(new INITextToSAITransformStream(options?.parser))
    .pipeThrough(new SAIToObjectTransformStream<T>());
}
