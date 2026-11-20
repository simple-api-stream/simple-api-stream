import type { EndRecordRowSACEventInterface } from "../event-interface/index.js";
import { SACEvent } from "./SACEvent.js";

/**
 * Event name constant for CSV record row end events.
 */
export const SAC_END_RECORD_ROW_EVENT_TYPE = "endRecordRow";

/**
 * Event class representing the end of a CSV record row.
 */
export class EndRecordRowEvent extends SACEvent<typeof SAC_END_RECORD_ROW_EVENT_TYPE> implements EndRecordRowSACEventInterface {
  constructor() {
    super(SAC_END_RECORD_ROW_EVENT_TYPE);
  }
}
