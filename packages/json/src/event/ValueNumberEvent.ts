import type { ValueNumberSAJEventInterface } from "../event-interface/index.js";
import { ValueEvent } from "./ValueEvent.js";

export class ValueNumberEvent extends ValueEvent<"number"> implements ValueNumberSAJEventInterface {
  constructor(type: "number", value: number) {
    super(type, value);
  }
}
