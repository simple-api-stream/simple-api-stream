import type { SAT_START_INLINE_TABLE_EVENT_TYPE } from "../event/StartInlineTableEvent.js";

/**
 * Interface representing the start of a TOML inline table (`{ ... }`) event.
 */
export interface StartInlineTableSATEventInterface {
  name: typeof SAT_START_INLINE_TABLE_EVENT_TYPE
}
