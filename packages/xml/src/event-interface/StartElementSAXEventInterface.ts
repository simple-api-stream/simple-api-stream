import type { SAX_START_ELEMENT_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing the start of an XML element event.
 */
export interface StartElementSAXEventInterface {
  name: typeof SAX_START_ELEMENT_EVENT_TYPE
  tagName: string
  attrs?: Record<string, string>
  selfClosing?: boolean
}
