import type { SAT_VALUE_EVENT_TYPE } from "../event/ValueEvent.js";

/**
 * Discriminator union of supported TOML primitive value types.
 */
export type ValueType
  = "string"
    | "integer"
    | "float"
    | "boolean"
    | "offsetDateTime"
    | "localDateTime"
    | "localDate"
    | "localTime";

/**
 * Mapping from TOML value type discriminator to its TypeScript value type.
 */
export type ValueDictionary = {
  string: string
  integer: number
  float: number
  boolean: boolean
  offsetDateTime: string
  localDateTime: string
  localDate: string
  localTime: string
};

/**
 * Interface representing a TOML primitive value event.
 */
export interface ValueSATEventInterface<VT extends ValueType = ValueType> {
  name: typeof SAT_VALUE_EVENT_TYPE
  type: VT
  value: ValueDictionary[VT]
}
