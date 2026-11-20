import type { ValueNullSAJEventInterface } from "../event-interface/index.js";
import { ValueEvent } from "./ValueEvent.js";

/**
 * Event class representing a JSON `null` value.
 */
export class ValueNullEvent extends ValueEvent<"null"> implements ValueNullSAJEventInterface {
  constructor(type: "null") {
    super(type, null);
  }
}
