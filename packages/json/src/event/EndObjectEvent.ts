import { SAJEvent } from "./SAJEvent.js";

/**
 * Event name constant for JSON object end events.
 */
export const SAJ_END_OBJECT_EVENT_TYPE = "endObject";

/**
 * Event class representing the end of a JSON object (`}`).
 */
export class EndObjectEvent extends SAJEvent<typeof SAJ_END_OBJECT_EVENT_TYPE> {
  constructor() {
    super(SAJ_END_OBJECT_EVENT_TYPE);
  }
}
