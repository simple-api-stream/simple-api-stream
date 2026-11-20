import type { StartObjectSAJEventInterface } from "../event-interface/index.js";
import { SAJEvent } from "./SAJEvent.js";

/**
 * Event name constant for JSON object start events.
 */
export const SAJ_START_OBJECT_EVENT_TYPE = "startObject";

/**
 * Event class representing the start of a JSON object (`{`).
 */
export class StartObjectEvent extends SAJEvent<typeof SAJ_START_OBJECT_EVENT_TYPE> implements StartObjectSAJEventInterface {
  constructor() {
    super(SAJ_START_OBJECT_EVENT_TYPE);
  }
}
