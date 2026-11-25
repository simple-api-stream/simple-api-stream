import {
  responseToTextStream,
  type ResponseToTextStreamOptions,
} from "@simple-api-stream/core";
import type { XMLDocumentNode } from "./node.js";
import { SAXToObjectTransformStream, type SAXToObjectTransformStreamOptions } from "./SAXToObjectTransformStream.js";
import { XMLTextToSAXTransformStream } from "./XMLTextToSAXTransformStream.js";

/**
 * Configuration options for `parseXMLResponse`.
 */
export type ParseXMLResponseOptions<T = XMLDocumentNode> = ResponseToTextStreamOptions & {
  /** Options forwarded to `XMLTextToSAXTransformStream`. */
  parser?: ConstructorParameters<typeof XMLTextToSAXTransformStream>[0]
  /** Options forwarded to `SAXToObjectTransformStream`. */
  object?: SAXToObjectTransformStreamOptions<T>
};

function isXMLMediaType(mediaType: string | null): boolean {
  if (!mediaType) return false;
  return (
    mediaType === "application/xml"
    || mediaType === "text/xml"
    || mediaType.endsWith("+xml")
  );
}

/**
 * Validates a Fetch `Response` (checking `Content-Type` by default) and streams reconstructed `XMLDocumentNode` trees (or mapped `T` values).
 */
export function parseXMLResponse<T = XMLDocumentNode>(
  response: Response,
  options?: ParseXMLResponseOptions<T>,
): ReadableStream<T> {
  return responseToTextStream(response, options, isXMLMediaType)
    .pipeThrough(new XMLTextToSAXTransformStream(options?.parser))
    .pipeThrough(new SAXToObjectTransformStream<T>(options?.object));
}
