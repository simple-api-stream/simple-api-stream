export * as events from "./event/index.js";

export type * as eventInterfaces from "./event-interface/index.js";

export type {
  CommentSSEEventInterface,
  EndDocumentSSEEventInterface,
  MessageSSEEventInterface,
  SSEEventInterface,
  SSEMessage,
  StartDocumentSSEEventInterface,
} from "./event-interface/index.js";

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
