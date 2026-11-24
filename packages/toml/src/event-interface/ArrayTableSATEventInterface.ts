import type { SAT_ARRAY_TABLE_EVENT_TYPE } from "../event/ArrayTableEvent.js";

/**
 * Interface representing a TOML array-of-tables header (`[[a.b]]`) event.
 */
export interface ArrayTableSATEventInterface {
  name: typeof SAT_ARRAY_TABLE_EVENT_TYPE
  path: string[]
}
