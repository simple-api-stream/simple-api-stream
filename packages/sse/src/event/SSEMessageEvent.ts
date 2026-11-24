import type { MessageSSEEventInterface, SSEMessage } from "../event-interface/index.js";
import { SSEEvent } from "./SSEEvent.js";

/**
 * Event name constant for SSE message events.
 */
export const SSE_MESSAGE_EVENT_TYPE = "message";

/**
 * Event class representing a dispatched Server-Sent Event message.
 */
export class SSEMessageEvent extends SSEEvent<typeof SSE_MESSAGE_EVENT_TYPE> implements MessageSSEEventInterface {
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
