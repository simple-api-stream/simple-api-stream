import { CommentEvent as BaseCommentEvent } from "@simple-api-stream/core";
import type { CommentSAYEventInterface } from "../event-interface/index.js";

/**
 * Event class representing a YAML comment (`# ...`).
 */
export class CommentEvent extends BaseCommentEvent implements CommentSAYEventInterface {}
