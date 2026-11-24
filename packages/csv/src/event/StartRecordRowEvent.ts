import type { StartRecordRowSACEventInterface } from "../event-interface/index.js";
import { SACEvent } from "./SACEvent.js";

/**
 * Event name constant for CSV record row start events.
 */
export const SAC_START_RECORD_ROW_EVENT_TYPE = "startRecordRow";

/**
 * Event class representing the start of a CSV record row.
 */
export class StartRecordRowEvent extends SACEvent<typeof SAC_START_RECORD_ROW_EVENT_TYPE> implements StartRecordRowSACEventInterface {
  constructor() {
    super(SAC_START_RECORD_ROW_EVENT_TYPE);
  }
}
