import type { ColumnSACEventInterface } from "../event-interface/index.js";
import { SACEvent } from "./SACEvent.js";

/**
 * Event name constant for CSV column (cell) events.
 */
export const SAC_COLUMN_EVENT_TYPE = "column";

/**
 * Optional metadata attached to a CSV column event.
 */
export interface ColumnEventOptions {
  index?: number
  header?: string
  quoted?: boolean
}

/**
 * Event class representing a CSV column (cell).
 */
export class ColumnEvent extends SACEvent<typeof SAC_COLUMN_EVENT_TYPE> implements ColumnSACEventInterface {
  value: string;
  declare index?: number;
  declare header?: string;
  declare quoted?: boolean;
  constructor(value: string, options?: ColumnEventOptions) {
    super(SAC_COLUMN_EVENT_TYPE);
    this.value = value;
    if (options?.index !== undefined) this.index = options.index;
    if (options?.header !== undefined) this.header = options.header;
    if (options?.quoted !== undefined) this.quoted = options.quoted;
  }
}
