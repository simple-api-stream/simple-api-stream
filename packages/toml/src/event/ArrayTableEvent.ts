import type { ArrayTableSATEventInterface } from "../event-interface/index.js";
import { SATEvent } from "./SATEvent.js";

/**
 * Event name constant for TOML array-of-tables header events.
 */
export const SAT_ARRAY_TABLE_EVENT_TYPE = "arrayTable";

/**
 * Event class representing a TOML array-of-tables header (`[[a.b]]`).
 */
export class ArrayTableEvent extends SATEvent<typeof SAT_ARRAY_TABLE_EVENT_TYPE> implements ArrayTableSATEventInterface {
  path: string[];

  constructor(path: string[]) {
    super(SAT_ARRAY_TABLE_EVENT_TYPE);
    this.path = path;
  }
}
