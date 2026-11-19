import type { SAJ_KEY_EVENT_TYPE } from "../event/KeyEvent.js";

export interface KeySAJEventInterface {
  name: typeof SAJ_KEY_EVENT_TYPE
  key: string
}
