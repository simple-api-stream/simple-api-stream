import type { TableSATEventInterface } from "../event-interface/index.js";
import { SATEvent } from "./SATEvent.js";

/**
 * Event name constant for TOML standard table header events.
 */
export const SAT_TABLE_EVENT_TYPE = "table";

/**
 * Event class representing a TOML standard table header (`[a.b]`).
 */
export class TableEvent extends SATEvent<typeof SAT_TABLE_EVENT_TYPE> implements TableSATEventInterface {
  path: string[];

  constructor(path: string[]) {
    super(SAT_TABLE_EVENT_TYPE);
    this.path = path;
  }
}
