import type { SAC_END_RECORD_ROW_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing the end of a CSV record row event.
 */
export interface EndRecordRowSACEventInterface {
  name: typeof SAC_END_RECORD_ROW_EVENT_TYPE
}
