import type { SAC_END_HEADER_ROW_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing the end of a CSV header row event.
 */
export interface EndHeaderRowSACEventInterface {
  name: typeof SAC_END_HEADER_ROW_EVENT_TYPE
}
