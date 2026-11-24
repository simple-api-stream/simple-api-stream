import type { SAX_CDATA_EVENT_TYPE } from "../event/CdataEvent.js";

/**
 * Interface representing an XML CDATA section event.
 */
export interface CdataSAXEventInterface {
  name: typeof SAX_CDATA_EVENT_TYPE
  cdata: string
}
