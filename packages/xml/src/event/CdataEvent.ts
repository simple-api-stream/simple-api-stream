import type { CdataSAXEventInterface } from "../event-interface/index.js";
import { SAXEvent } from "./SAXEvent.js";

/**
 * Event name constant for XML CDATA section events.
 */
export const SAX_CDATA_EVENT_TYPE = "cdata";

/**
 * Event class representing an XML `<![CDATA[...]]>` section.
 */
export class CdataEvent extends SAXEvent<typeof SAX_CDATA_EVENT_TYPE> implements CdataSAXEventInterface {
  cdata: string;
  constructor(cdata: string) {
    super(SAX_CDATA_EVENT_TYPE);
    this.cdata = cdata;
  }
}
