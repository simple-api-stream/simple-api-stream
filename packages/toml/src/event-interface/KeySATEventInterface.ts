import type { SAT_KEY_EVENT_TYPE } from "../event/KeyEvent.js";

/**
 * Interface representing a TOML key or dotted key (`a.b = ...`) event.
 */
export interface KeySATEventInterface {
  name: typeof SAT_KEY_EVENT_TYPE
  path: string[]
}
