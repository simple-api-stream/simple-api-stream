import type { StartHeaderRowSACEventInterface } from "../event-interface/index.js";
import { SACEvent } from "./SACEvent.js";

/**
 * Event name constant for CSV header row start events.
 */
export const SAC_START_HEADER_ROW_EVENT_TYPE = "startHeaderRow";

/**
 * Event class representing the start of a CSV header row.
 */
export class StartHeaderRowEvent extends SACEvent<typeof SAC_START_HEADER_ROW_EVENT_TYPE> implements StartHeaderRowSACEventInterface {
  constructor() {
    super(SAC_START_HEADER_ROW_EVENT_TYPE);
  }
}
