import type { SAX_END_ELEMENT_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing the end of an XML element event.
 */
export interface EndElementSAXEventInterface {
  name: typeof SAX_END_ELEMENT_EVENT_TYPE
  tagName: string
}
