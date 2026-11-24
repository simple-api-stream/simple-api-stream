import type { SAJ_START_OBJECT_EVENT_TYPE } from "../event/StartObjectEvent.js";

/**
 * Interface representing the start of a JSON object event.
 */
export interface StartObjectSAJEventInterface {
  name: typeof SAJ_START_OBJECT_EVENT_TYPE
}
