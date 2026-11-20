import type { StartArraySAJEventInterface } from "../event-interface/index.js";
import { SAJEvent } from "./SAJEvent.js";

/**
 * Event name constant for JSON array start events.
 */
export const SAJ_START_ARRAY_EVENT_TYPE = "startArray";

/**
 * Event class representing the start of a JSON array (`[`).
 */
export class StartArrayEvent extends SAJEvent<typeof SAJ_START_ARRAY_EVENT_TYPE> implements StartArraySAJEventInterface {
  constructor() {
    super(SAJ_START_ARRAY_EVENT_TYPE);
  }
}
