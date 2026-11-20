import type { ValueStringSAJEventInterface } from "../event-interface/index.js";
import { ValueEvent } from "./ValueEvent.js";

export class ValueStringEvent extends ValueEvent<"string"> implements ValueStringSAJEventInterface {
  constructor(type: "string", value: string) {
    super(type, value);
  }
}
