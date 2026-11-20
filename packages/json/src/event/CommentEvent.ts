import type { CommentSAJEventInterface } from "../event-interface/index.js";
import { SAJEvent } from "./SAJEvent.js";

/**
 * Event name constant for JSONC comment events.
 */
export const SAJ_COMMENT_EVENT_TYPE = "comment";

/**
 * Event class representing a JSONC comment (`// ...` or `/* ... *\/`).
 */
export class CommentEvent extends SAJEvent<typeof SAJ_COMMENT_EVENT_TYPE> implements CommentSAJEventInterface {
  comment: string;
  declare style?: "line" | "block";
  constructor(comment: string, style?: "line" | "block") {
    super(SAJ_COMMENT_EVENT_TYPE);
    this.comment = comment;
    if (style !== undefined) this.style = style;
  }
}
