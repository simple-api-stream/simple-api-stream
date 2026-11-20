import type { EndArraySAJEventInterface } from "../event-interface/index.js";
import { SAJEvent } from "./SAJEvent.js";

/**
 * Event name constant for JSON array end events.
 */
export const SAJ_END_ARRAY_EVENT_TYPE = "endArray";

/**
 * Event class representing the end of a JSON array (`]`).
 */
export class EndArrayEvent extends SAJEvent<typeof SAJ_END_ARRAY_EVENT_TYPE> implements EndArraySAJEventInterface {
  constructor() {
    super(SAJ_END_ARRAY_EVENT_TYPE);
  }
}
