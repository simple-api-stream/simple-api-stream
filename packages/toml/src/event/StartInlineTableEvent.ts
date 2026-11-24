import type { StartInlineTableSATEventInterface } from "../event-interface/index.js";
import { SATEvent } from "./SATEvent.js";

/**
 * Event name constant for TOML inline table start events.
 */
export const SAT_START_INLINE_TABLE_EVENT_TYPE = "startInlineTable";

/**
 * Event class representing the start of a TOML inline table (`{ ... }`).
 */
export class StartInlineTableEvent extends SATEvent<typeof SAT_START_INLINE_TABLE_EVENT_TYPE> implements StartInlineTableSATEventInterface {
  constructor() {
    super(SAT_START_INLINE_TABLE_EVENT_TYPE);
  }
}
