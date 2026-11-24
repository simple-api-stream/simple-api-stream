import { SAX_TEXT_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing an XML text node event.
 */
export interface TextSAXEventInterface {
  name: typeof SAX_TEXT_EVENT_TYPE
  text: string
}
