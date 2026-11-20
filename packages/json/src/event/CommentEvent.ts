import { CommentEvent as BaseEvent } from "@simple-api-stream/core";
import type { CommentSAJEventInterface } from "../event-interface/index.js";

/**
 * Event name constant for JSONC comment events.
 */
export const SAJ_COMMENT_EVENT_TYPE = "comment";

/**
 * Event class representing a JSONC comment (`// ...` or `/* ... *\/`).
 */
export class CommentEvent extends BaseEvent implements CommentSAJEventInterface {
  declare style?: "line" | "block";
  constructor(comment: string, style?: "line" | "block") {
    super(comment);
    if (style !== undefined) this.style = style;
  }
}
