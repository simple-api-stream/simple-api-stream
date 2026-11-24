import type { SAJ_KEY_EVENT_TYPE } from "../event/KeyEvent.js";

/**
 * Interface representing a JSON object property key event.
 */
export interface KeySAJEventInterface {
  name: typeof SAJ_KEY_EVENT_TYPE
  key: string
}
