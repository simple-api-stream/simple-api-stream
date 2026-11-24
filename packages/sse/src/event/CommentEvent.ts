import { CommentEvent as BaseCommentEvent } from "@simple-api-stream/core";
import type { CommentSSEEventInterface } from "../event-interface/index.js";

/**
 * Event class representing an SSE comment (`: ...`).
 */
export class CommentEvent extends BaseCommentEvent implements CommentSSEEventInterface {}
