import type { SAJ_END_OBJECT_EVENT_TYPE } from "../event/EndObjectEvent.js";

/**
 * Interface representing the end of a JSON object event.
 */
export interface EndObjectSAJEventInterface {
  name: typeof SAJ_END_OBJECT_EVENT_TYPE
}
