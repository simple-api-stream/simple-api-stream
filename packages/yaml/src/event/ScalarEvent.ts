import type {
  ScalarSAYEventInterface,
  ScalarStyle,
  ScalarValueType,
  ScalarValueTypeMap,
} from "../event-interface/index.js";
import { SAYEvent } from "./SAYEvent.js";

export const SAY_SCALAR_EVENT_TYPE = "scalar";

export type ScalarEventOptions = {
  style?: ScalarStyle
  anchor?: string
  tag?: string
};

/**
 * Event class representing a YAML scalar value.
 */
export class ScalarEvent<VT extends ScalarValueType = ScalarValueType> extends SAYEvent<typeof SAY_SCALAR_EVENT_TYPE> {
  type: VT;
  value: ScalarValueTypeMap[VT];
  declare style?: ScalarStyle;
  declare anchor?: string;
  declare tag?: string;

  constructor(type: VT, value: ScalarValueTypeMap[VT], options?: ScalarEventOptions) {
    super(SAY_SCALAR_EVENT_TYPE);
    this.type = type;
    this.value = value;
    if (options?.style !== undefined) this.style = options.style;
    if (options?.anchor !== undefined) this.anchor = options.anchor;
    if (options?.tag !== undefined) this.tag = options.tag;
  }

  /**
   * Narrows this event instance to the `ScalarSAYEventInterface` discriminated union.
   */
  toInterface(): ScalarSAYEventInterface {
    return this as unknown as ScalarSAYEventInterface;
  }
}
