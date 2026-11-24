import type { StartArraySATEventInterface } from "../event-interface/index.js";
import { SATEvent } from "./SATEvent.js";

/**
 * Event name constant for TOML array start events.
 */
export const SAT_START_ARRAY_EVENT_TYPE = "startArray";

/**
 * Event class representing the start of a TOML array (`[ ... ]`).
 */
export class StartArrayEvent extends SATEvent<typeof SAT_START_ARRAY_EVENT_TYPE> implements StartArraySATEventInterface {
  constructor() {
    super(SAT_START_ARRAY_EVENT_TYPE);
  }
}
