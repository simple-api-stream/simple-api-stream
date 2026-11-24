import type { DoctypeSAXEventBaseInterface } from "./DoctypeSAXEventBaseInterface.js";

/**
 * Interface representing a `SYSTEM` XML DOCTYPE declaration event.
 */
export interface DoctypeSAXEventSystemInterface extends DoctypeSAXEventBaseInterface {
  dtdType: "SYSTEM"
  /** uri reference */
  uri: string
}
