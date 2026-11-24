import type { CommentSAEventInterface } from "../event-interface/index.js";
import { SAEvent } from "./SAEvent.js";

/**
 * Event name constant for comment events.
 */
export const SA_COMMENT_EVENT_TYPE = "comment";

/**
 * Base event class representing a comment event.
 */
export class CommentEvent extends SAEvent<typeof SA_COMMENT_EVENT_TYPE> implements CommentSAEventInterface {
  comment: string;
  constructor(comment: string) {
    super(SA_COMMENT_EVENT_TYPE);
    this.comment = comment;
  }
}
