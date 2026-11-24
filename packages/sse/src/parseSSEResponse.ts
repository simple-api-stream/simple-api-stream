import {
  responseToTextStream,
  type ResponseToTextStreamOptions,
} from "@simple-api-stream/core";
import type { SSEEventInterface, SSEMessage } from "./events.js";
import {
  SSETextToEventTransformStream,
  type SSETextToEventTransformStreamOptions,
} from "./SSETextToEventTransformStream.js";

const skip = Symbol.for("parseSSEResponse.skip");

/**
 * Callback that maps a dispatched `SSEMessage` into a custom value of type `T` (or returns `skip` to omit it).
 */
export type SSEMessageMapper<T> = (
  message: SSEMessage,
  context: { skip: typeof skip },
) => T | typeof skip;

/**
 * Configuration options for `parseSSEResponse`.
 */
export type ParseSSEResponseOptions<T = SSEMessage> = ResponseToTextStreamOptions & {
  /** Options forwarded to `SSETextToEventTransformStream`. */
  parser?: SSETextToEventTransformStreamOptions
  /** Optional mapper transforming each `SSEMessage` into `T` (or returning `skip` to filter out messages such as `"[DONE]"`). */
  mapMessage?: SSEMessageMapper<T>
};

function isSSEMediaType(mediaType: string | null): boolean {
  return mediaType === "text/event-stream";
}

/**
 * Validates a Fetch `Response` (checking `Content-Type: text/event-stream` by default) and streams dispatched `SSEMessage` objects (or mapped `T` values).
 */
export function parseSSEResponse<T = SSEMessage>(
  response: Response,
  options?: ParseSSEResponseOptions<T>,
): ReadableStream<T> {
  const mapMessage = options?.mapMessage;

  return responseToTextStream(response, options, isSSEMediaType)
    .pipeThrough(new SSETextToEventTransformStream({ skipDocument: true, ...options?.parser }))
    .pipeThrough(new TransformStream<SSEEventInterface, T>({
      transform(event, controller) {
        if (event.name !== "message") return;
        const msg: SSEMessage = {
          data: event.data,
          ...(event.event !== undefined ? { event: event.event } : {}),
          ...(event.id !== undefined ? { id: event.id } : {}),
          ...(event.retry !== undefined ? { retry: event.retry } : {}),
        };
        if (!mapMessage) {
          controller.enqueue(msg as T);
          return;
        }
        const mapped = mapMessage(msg, { skip });
        if (mapped !== skip) {
          controller.enqueue(mapped);
        }
      },
    }));
}
