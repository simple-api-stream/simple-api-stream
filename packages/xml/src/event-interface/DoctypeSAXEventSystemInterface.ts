import type { DoctypeSAXEventBaseInterface } from "./DoctypeSAXEventBaseInterface.js";

export interface DoctypeSAXEventSystemInterface extends DoctypeSAXEventBaseInterface {
  dtdType: "SYSTEM"
  /** uri reference */
  uri: string
}
