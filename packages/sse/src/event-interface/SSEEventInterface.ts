import type { CommentSSEEventInterface } from "./CommentSSEEventInterface.js";
import type { EndDocumentSSEEventInterface } from "./EndDocumentSSEEventInterface.js";
import type { MessageSSEEventInterface } from "./MessageSSEEventInterface.js";
import type { StartDocumentSSEEventInterface } from "./StartDocumentSSEEventInterface.js";

/**
 * Union type of all SSE event interfaces.
 */
export type SSEEventInterface
  = StartDocumentSSEEventInterface
    | EndDocumentSSEEventInterface
    | CommentSSEEventInterface
    | MessageSSEEventInterface;
