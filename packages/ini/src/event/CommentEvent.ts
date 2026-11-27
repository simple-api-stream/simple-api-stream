import { CommentEvent as BaseEvent } from "@simple-api-stream/core";
import type { CommentSAIEventInterface } from "../event-interface/index.js";

/**
 * Event name constant for INI comment events.
 */
export const SAI_COMMENT_EVENT_TYPE = "comment";

/**
 * Event class representing an INI comment (`; ...` or `# ...`).
 */
export class CommentEvent extends BaseEvent implements CommentSAIEventInterface {
  declare prefix?: string;
  constructor(comment: string, prefix?: string) {
    super(comment);
    if (prefix !== undefined) this.prefix = prefix;
  }
}
