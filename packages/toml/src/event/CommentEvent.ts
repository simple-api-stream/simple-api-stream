import { CommentEvent as BaseCommentEvent } from "@simple-api-stream/core";
import type { CommentSATEventInterface } from "../event-interface/index.js";

/**
 * Event class representing a TOML comment (`# ...`).
 */
export class CommentEvent extends BaseCommentEvent implements CommentSATEventInterface {}
