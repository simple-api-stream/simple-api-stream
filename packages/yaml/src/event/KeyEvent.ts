import type { KeySAYEventInterface } from "../event-interface/index.js";
import { SAYEvent } from "./SAYEvent.js";

export const SAY_KEY_EVENT_TYPE = "key";

/**
 * Event class representing a YAML mapping key.
 */
export class KeyEvent extends SAYEvent<typeof SAY_KEY_EVENT_TYPE> implements KeySAYEventInterface {
  key: string;
  constructor(key: string) {
    super(SAY_KEY_EVENT_TYPE);
    this.key = key;
  }
}
