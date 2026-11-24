import type { KeySATEventInterface } from "../event-interface/index.js";
import { SATEvent } from "./SATEvent.js";

/**
 * Event name constant for TOML key events.
 */
export const SAT_KEY_EVENT_TYPE = "key";

/**
 * Event class representing a TOML key or dotted key (`a.b = ...`).
 */
export class KeyEvent extends SATEvent<typeof SAT_KEY_EVENT_TYPE> implements KeySATEventInterface {
  path: string[];

  constructor(path: string[]) {
    super(SAT_KEY_EVENT_TYPE);
    this.path = path;
  }
}
