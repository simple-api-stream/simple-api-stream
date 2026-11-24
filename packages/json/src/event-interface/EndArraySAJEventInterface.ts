import type { SAJ_END_ARRAY_EVENT_TYPE } from "../event/EndArrayEvent.js";

/**
 * Interface representing the end of a JSON array event.
 */
export interface EndArraySAJEventInterface {
  name: typeof SAJ_END_ARRAY_EVENT_TYPE
}
