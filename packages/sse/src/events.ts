import {
  CommentEvent as CoreCommentEvent,
  EndDocumentEvent as CoreEndDocumentEvent,
  SAEvent,
  StartDocumentEvent as CoreStartDocumentEvent,
  type CommentSAEventInterface,
  type EndDocumentSAEventInterface,
  type StartDocumentSAEventInterface,
} from "@simple-api-stream/core";

/**
 * Document kind discriminator for SSE streams.
 */
export const SSE_DOCUMENT_KIND = "sse";

/**
 * Event name constant for SSE message events.
 */
export const SSE_MESSAGE_EVENT_TYPE = "message";

/**
 * Plain-object representation of a dispatched Server-Sent Event message.
 */
export interface SSEMessage {
  /** Payload assembled from one or more `data:` lines (joined with `"\n"`). */
  data: string
  /** Event type from the `event:` field, if specified. */
  event?: string
  /** Last event ID from the `id:` field, if specified. */
  id?: string
  /** Reconnection delay in milliseconds from the `retry:` field, if specified. */
  retry?: number
}

/**
 * Interface representing the start of an SSE document stream.
 */
export type StartDocumentSSEEventInterface = StartDocumentSAEventInterface<typeof SSE_DOCUMENT_KIND>;

/**
 * Interface representing the end of an SSE document stream.
 */
export type EndDocumentSSEEventInterface = EndDocumentSAEventInterface;

/**
 * Interface representing an SSE comment (`: ...`) event.
 */
export type CommentSSEEventInterface = CommentSAEventInterface;

/**
 * Interface representing a dispatched SSE message event.
 */
export interface MessageSSEEventInterface extends SSEMessage {
  name: typeof SSE_MESSAGE_EVENT_TYPE
}

/**
 * Union type of all SSE event interfaces.
 */
export type SSEEventInterface =
  | StartDocumentSSEEventInterface
  | EndDocumentSSEEventInterface
  | CommentSSEEventInterface
  | MessageSSEEventInterface;

/**
 * Event class representing the start of an SSE stream (`kind: "sse"`).
 */
export class StartDocumentEvent extends CoreStartDocumentEvent<typeof SSE_DOCUMENT_KIND> implements StartDocumentSSEEventInterface {
  constructor() {
    super(SSE_DOCUMENT_KIND);
  }
}

/**
 * Event class representing the end of an SSE stream.
 */
export class EndDocumentEvent extends CoreEndDocumentEvent implements EndDocumentSSEEventInterface {}

/**
 * Event class representing an SSE comment (`: ...`).
 */
export class CommentEvent extends CoreCommentEvent implements CommentSSEEventInterface {}

/**
 * Event class representing a dispatched Server-Sent Event message.
 */
export class SSEMessageEvent extends SAEvent<typeof SSE_MESSAGE_EVENT_TYPE> implements MessageSSEEventInterface {
  data: string;
  declare event?: string;
  declare id?: string;
  declare retry?: number;

  constructor(message: SSEMessage) {
    super(SSE_MESSAGE_EVENT_TYPE);
    this.data = message.data;
    if (message.event !== undefined) this.event = message.event;
    if (message.id !== undefined) this.id = message.id;
    if (message.retry !== undefined) this.retry = message.retry;
  }
}
