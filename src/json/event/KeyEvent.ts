import { SAJEvent } from "./SAJEvent.js";
import type { KeySAJEventInterface } from "../event-interface/index.js";

export const SAJ_KEY_EVENT_TYPE = "key";
export class KeyEvent extends SAJEvent<typeof SAJ_KEY_EVENT_TYPE> implements KeySAJEventInterface {
  key: string;
  constructor(key: string) {
    super(SAJ_KEY_EVENT_TYPE);
    this.key = key;
  }
}
