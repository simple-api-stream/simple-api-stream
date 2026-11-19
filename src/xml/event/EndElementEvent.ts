import type { EndElementSAXEventInterface } from "../event-interface/index.js";
import { SAXEvent } from "./SAXEvent.js";

export const SAX_END_ELEMENT_EVENT_TYPE = "endElement";
export class EndElementEvent extends SAXEvent<typeof SAX_END_ELEMENT_EVENT_TYPE> implements EndElementSAXEventInterface {
  tagName: string;
  constructor(tagName: string) {
    super(SAX_END_ELEMENT_EVENT_TYPE);
    this.tagName = tagName;
  }
}
