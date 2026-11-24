import type { SAC_START_RECORD_ROW_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing the start of a CSV record row event.
 */
export interface StartRecordRowSACEventInterface {
  name: typeof SAC_START_RECORD_ROW_EVENT_TYPE
}
