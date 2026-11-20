import type { StartElementSAXEventInterface } from "../event-interface/index.js";
import { SAXEvent } from "./SAXEvent.js";

/**
 * Event name constant for XML element start events.
 */
export const SAX_START_ELEMENT_EVENT_TYPE = "startElement";

/**
 * Event class representing the start of an XML element (`<tag ...>` or `<tag ... />`).
 */
export class StartElementEvent extends SAXEvent<typeof SAX_START_ELEMENT_EVENT_TYPE> implements StartElementSAXEventInterface {
  tagName: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  constructor(tagName: string, attrs: Record<string, string> = {}, selfClosing: boolean = false) {
    super(SAX_START_ELEMENT_EVENT_TYPE);
    this.tagName = tagName;
    this.attrs = attrs;
    this.selfClosing = selfClosing;
  }
}
