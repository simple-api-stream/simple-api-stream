import type { SAJ_START_ARRAY_EVENT_TYPE } from "../event/StartArrayEvent.js";

/**
 * Interface representing the start of a JSON array event.
 */
export interface StartArraySAJEventInterface {
  name: typeof SAJ_START_ARRAY_EVENT_TYPE
}
