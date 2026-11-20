import type { CommentSAXEventInterface } from "../event-interface/CommentSAXEventInterface.js";
import { SAXEvent } from "./SAXEvent.js";

/**
 * Event name constant for XML comment events.
 */
export const SAX_COMMENT_EVENT_TYPE = "comment";

/**
 * Event class representing an XML `<!-- ... -->` comment.
 */
export class CommentEvent extends SAXEvent<typeof SAX_COMMENT_EVENT_TYPE> implements CommentSAXEventInterface {
  comment: string;
  constructor(comment: string) {
    super(SAX_COMMENT_EVENT_TYPE);
    this.comment = comment;
  }
}
