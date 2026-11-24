import type { SAT_END_ARRAY_EVENT_TYPE } from "../event/EndArrayEvent.js";

/**
 * Interface representing the end of a TOML array (`[ ... ]`) event.
 */
export interface EndArraySATEventInterface {
  name: typeof SAT_END_ARRAY_EVENT_TYPE
}
