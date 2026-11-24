import type { SAT_END_INLINE_TABLE_EVENT_TYPE } from "../event/EndInlineTableEvent.js";

/**
 * Interface representing the end of a TOML inline table (`{ ... }`) event.
 */
export interface EndInlineTableSATEventInterface {
  name: typeof SAT_END_INLINE_TABLE_EVENT_TYPE
}
