import type { SAX_END_ELEMENT_EVENT_TYPE } from "../event/index.js";

export interface EndElementSAXEventInterface {
  name: typeof SAX_END_ELEMENT_EVENT_TYPE
  tagName: string
}
