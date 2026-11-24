import type { SAC_START_HEADER_ROW_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing the start of a CSV header row event.
 */
export interface StartHeaderRowSACEventInterface {
  name: typeof SAC_START_HEADER_ROW_EVENT_TYPE
}
