import type { SAT_TABLE_EVENT_TYPE } from "../event/TableEvent.js";

/**
 * Interface representing a TOML standard table header (`[a.b]`) event.
 */
export interface TableSATEventInterface {
  name: typeof SAT_TABLE_EVENT_TYPE
  path: string[]
}
