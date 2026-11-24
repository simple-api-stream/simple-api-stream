import type { CommentSAEventInterface } from "@simple-api-stream/core";

/**
 * Interface representing a JSONC comment event.
 */
export interface CommentSAJEventInterface extends CommentSAEventInterface {
  style?: "line" | "block"
}
