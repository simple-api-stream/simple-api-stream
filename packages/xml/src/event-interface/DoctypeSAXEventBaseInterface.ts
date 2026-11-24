import type { SAX_DOCTYPE_EVENT_TYPE } from "../event/DoctypeBaseEvent.js";

/**
 * Base interface for XML DOCTYPE declaration events.
 */
export interface DoctypeSAXEventBaseInterface {
  name: typeof SAX_DOCTYPE_EVENT_TYPE
  root: string
  declarations?: string[]
}
