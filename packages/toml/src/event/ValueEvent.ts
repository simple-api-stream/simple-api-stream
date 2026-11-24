import type { ValueDictionary, ValueSATEventInterface, ValueType } from "../event-interface/index.js";
import { SATEvent } from "./SATEvent.js";

/**
 * Event name constant for TOML primitive value events.
 */
export const SAT_VALUE_EVENT_TYPE = "value";

/**
 * Event class representing a TOML primitive value.
 */
export class ValueEvent<VT extends ValueType = ValueType> extends SATEvent<typeof SAT_VALUE_EVENT_TYPE> implements ValueSATEventInterface<VT> {
  type: VT;
  value: ValueDictionary[VT];

  constructor(type: VT, value: ValueDictionary[VT]) {
    super(SAT_VALUE_EVENT_TYPE);
    this.type = type;
    this.value = value;
  }
}
