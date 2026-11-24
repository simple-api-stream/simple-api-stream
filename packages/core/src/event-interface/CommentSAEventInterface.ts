import type { SA_COMMENT_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing a comment event.
 */
export interface CommentSAEventInterface {
  name: typeof SA_COMMENT_EVENT_TYPE
  comment: string
}
