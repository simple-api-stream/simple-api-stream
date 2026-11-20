import type { SAC_COLUMN_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing a CSV column (cell) event.
 */
export interface ColumnSACEventInterface {
  name: typeof SAC_COLUMN_EVENT_TYPE
  value: string
  index?: number
  header?: string
  quoted?: boolean
}
