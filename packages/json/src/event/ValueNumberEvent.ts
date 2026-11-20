import type { ValueNumberSAJEventInterface } from "../event-interface/index.js";
import { ValueEvent } from "./ValueEvent.js";

/**
 * Event class representing a JSON number value.
 */
export class ValueNumberEvent extends ValueEvent<"number"> implements ValueNumberSAJEventInterface {
  constructor(type: "number", value: number) {
    super(type, value);
  }
}
