import type { SAJ_COMMENT_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing a JSONC comment event.
 */
export interface CommentSAJEventInterface {
  name: typeof SAJ_COMMENT_EVENT_TYPE
  comment: string
  style?: "line" | "block"
}
