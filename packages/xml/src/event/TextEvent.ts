import type { TextSAXEventInterface } from "../event-interface/index.js";
import { SAXEvent } from "./SAXEvent.js";

/**
 * Event name constant for XML text node events.
 */
export const SAX_TEXT_EVENT_TYPE = "text";

/**
 * Event class representing XML character text data.
 */
export class TextEvent extends SAXEvent<typeof SAX_TEXT_EVENT_TYPE> implements TextSAXEventInterface {
  text: string;
  constructor(text: string) {
    super(SAX_TEXT_EVENT_TYPE);
    this.text = text;
  }
}
