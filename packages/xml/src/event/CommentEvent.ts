import { CommentEvent as BaseEvent } from "@simple-api-stream/core";
import type { CommentSAXEventInterface } from "../event-interface/CommentSAXEventInterface.js";

/**
 * Event name constant for XML comment events.
 */
export const SAX_COMMENT_EVENT_TYPE = "comment";

/**
 * Event class representing an XML `<!-- ... -->` comment.
 */
export class CommentEvent extends BaseEvent implements CommentSAXEventInterface {}
