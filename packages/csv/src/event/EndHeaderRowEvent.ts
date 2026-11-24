import type { EndHeaderRowSACEventInterface } from "../event-interface/index.js";
import { SACEvent } from "./SACEvent.js";

/**
 * Event name constant for CSV header row end events.
 */
export const SAC_END_HEADER_ROW_EVENT_TYPE = "endHeaderRow";

/**
 * Event class representing the end of a CSV header row.
 */
export class EndHeaderRowEvent extends SACEvent<typeof SAC_END_HEADER_ROW_EVENT_TYPE> implements EndHeaderRowSACEventInterface {
  constructor() {
    super(SAC_END_HEADER_ROW_EVENT_TYPE);
  }
}
