import type { SAT_START_ARRAY_EVENT_TYPE } from "../event/StartArrayEvent.js";

/**
 * Interface representing the start of a TOML array (`[ ... ]`) event.
 */
export interface StartArraySATEventInterface {
  name: typeof SAT_START_ARRAY_EVENT_TYPE
}
