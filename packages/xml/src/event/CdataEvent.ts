import type { CdataSAXEventInterface } from "../event-interface/index.js";
import { SAXEvent } from "./SAXEvent.js";

export const SAX_CDATA_EVENT_TYPE = "cdata";
export class CdataEvent extends SAXEvent<typeof SAX_CDATA_EVENT_TYPE> implements CdataSAXEventInterface {
  cdata: string;
  constructor(cdata: string) {
    super(SAX_CDATA_EVENT_TYPE);
    this.cdata = cdata;
  }
}
