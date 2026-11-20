import type { ValueSAJEventInterface } from "../event-interface/index.js";
import { TypeEvent } from "./TypeEvent.js";

type ValueType = "number" | "string" | "null" | "boolean";
type ValueDictionary = {
  number: number
  string: string
  null: null
  boolean: boolean
};
/**
 * Event name constant for JSON primitive value events.
 */
export const SAJ_VALUE_EVENT_TYPE = "value";

/**
 * Base event class representing a JSON primitive value.
 */
export class ValueEvent<VT extends ValueType> extends TypeEvent<typeof SAJ_VALUE_EVENT_TYPE, VT> implements ValueSAJEventInterface<VT> {
  value: ValueDictionary[VT];
  constructor(type: VT, value: ValueDictionary[VT]) {
    super(SAJ_VALUE_EVENT_TYPE, type);
    this.value = value;
  }
}
