import type { CommentSAEventInterface } from "@simple-api-stream/core";

/**
 * Interface for an INI comment event (`; ...` or `# ...`).
 */
export interface CommentSAIEventInterface extends CommentSAEventInterface {
  /** The comment prefix character(s) encountered in the source text (e.g. `";"` or `"#"`). */
  prefix?: string
}
