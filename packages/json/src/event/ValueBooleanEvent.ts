import type { ValueBooleanSAJEventInterface } from "../event-interface/index.js";
import { ValueEvent } from "./ValueEvent.js";

/**
 * Event class representing a JSON boolean value.
 */
export class ValueBooleanEvent extends ValueEvent<"boolean"> implements ValueBooleanSAJEventInterface {
  constructor(type: "boolean", value: boolean) {
    super(type, value);
  }
}
