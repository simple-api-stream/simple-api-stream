import { SAJEvent } from "./SAJEvent.js";
import type { KeySAJEventInterface } from "../event-interface/index.js";

/**
 * Event name constant for JSON object key events.
 */
export const SAJ_KEY_EVENT_TYPE = "key";

/**
 * Event class representing a property key in a JSON object.
 */
export class KeyEvent extends SAJEvent<typeof SAJ_KEY_EVENT_TYPE> implements KeySAJEventInterface {
  key: string;
  constructor(key: string) {
    super(SAJ_KEY_EVENT_TYPE);
    this.key = key;
  }
}
