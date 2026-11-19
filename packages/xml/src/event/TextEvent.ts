import type { TextSAXEventInterface } from "../event-interface/index.js";
import { SAXEvent } from "./SAXEvent.js";

export const SAX_TEXT_EVENT_TYPE = "text";
export class TextEvent extends SAXEvent<typeof SAX_TEXT_EVENT_TYPE> implements TextSAXEventInterface {
  text: string;
  constructor(text: string) {
    super(SAX_TEXT_EVENT_TYPE);
    this.text = text;
  }
}
