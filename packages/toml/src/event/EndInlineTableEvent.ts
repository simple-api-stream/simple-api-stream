import type { EndInlineTableSATEventInterface } from "../event-interface/index.js";
import { SATEvent } from "./SATEvent.js";

/**
 * Event name constant for TOML inline table end events.
 */
export const SAT_END_INLINE_TABLE_EVENT_TYPE = "endInlineTable";

/**
 * Event class representing the end of a TOML inline table (`{ ... }`).
 */
export class EndInlineTableEvent extends SATEvent<typeof SAT_END_INLINE_TABLE_EVENT_TYPE> implements EndInlineTableSATEventInterface {
  constructor() {
    super(SAT_END_INLINE_TABLE_EVENT_TYPE);
  }
}
