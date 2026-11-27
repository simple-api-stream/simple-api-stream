import {
  responseToTextStream,
  type ResponseToTextStreamOptions,
} from "@simple-api-stream/core";
import { SAYToObjectTransformStream, type SAYToObjectTransformStreamOptions } from "./SAYToObjectTransformStream.js";
import { YAMLTextToSAYTransformStream } from "./YAMLTextToSAYTransformStream.js";

/**
 * Configuration options for `parseYAMLResponse`.
 */
export type ParseYAMLResponseOptions = ResponseToTextStreamOptions & {
  /** Options forwarded to `YAMLTextToSAYTransformStream`. */
  parser?: ConstructorParameters<typeof YAMLTextToSAYTransformStream>[0]
  /** Options forwarded to `SAYToObjectTransformStream`. */
  object?: SAYToObjectTransformStreamOptions
};

const YAML_MEDIA_TYPES = new Set([
  "application/yaml",
  "text/yaml",
  "application/x-yaml",
  "text/x-yaml",
]);

function isYAMLMediaType(mediaType: string | null): boolean {
  if (!mediaType) return false;
  return YAML_MEDIA_TYPES.has(mediaType);
}

/**
 * Validates a Fetch `Response` (checking `Content-Type` by default) and streams reconstructed YAML values of type `T`.
 */
export function parseYAMLResponse<T = unknown>(
  response: Response,
  options?: ParseYAMLResponseOptions,
): ReadableStream<T> {
  return responseToTextStream(response, options, isYAMLMediaType)
    .pipeThrough(new YAMLTextToSAYTransformStream(options?.parser))
    .pipeThrough(new SAYToObjectTransformStream<T>(options?.object));
}
