export * as events from "./events.js";
export type {
  CommentSSEEventInterface,
  EndDocumentSSEEventInterface,
  MessageSSEEventInterface,
  SSEEventInterface,
  SSEMessage,
  StartDocumentSSEEventInterface,
} from "./events.js";

import * as SSETextToEventTransformStreamModule from "./SSETextToEventTransformStream.js";
import * as SSEEventToTextTransformStreamModule from "./SSEEventToTextTransformStream.js";

/**
 * Namespace containing all SSE stream classes.
 */
export const streams = {
  ...SSETextToEventTransformStreamModule,
  ...SSEEventToTextTransformStreamModule,
};

export {
  SSETextToEventTransformStream,
  type SSETextToEventTransformStreamOptions,
} from "./SSETextToEventTransformStream.js";
export {
  SSEEventToTextTransformStream,
  type SSEEventToTextTransformStreamOptions,
} from "./SSEEventToTextTransformStream.js";
export {
  parseSSEResponse,
  type ParseSSEResponseOptions,
  type SSEMessageMapper,
} from "./parseSSEResponse.js";
