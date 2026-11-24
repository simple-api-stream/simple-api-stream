import type { SSE_MESSAGE_EVENT_TYPE } from "../event/index.js";
import type { SSEMessage } from "./SSEMessage.js";

/**
 * Interface representing a dispatched SSE message event.
 */
export interface MessageSSEEventInterface extends SSEMessage {
  name: typeof SSE_MESSAGE_EVENT_TYPE
}
