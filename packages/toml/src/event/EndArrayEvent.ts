import type { EndArraySATEventInterface } from "../event-interface/index.js";
import { SATEvent } from "./SATEvent.js";

/**
 * Event name constant for TOML array end events.
 */
export const SAT_END_ARRAY_EVENT_TYPE = "endArray";

/**
 * Event class representing the end of a TOML array (`[ ... ]`).
 */
export class EndArrayEvent extends SATEvent<typeof SAT_END_ARRAY_EVENT_TYPE> implements EndArraySATEventInterface {
  constructor() {
    super(SAT_END_ARRAY_EVENT_TYPE);
  }
}
