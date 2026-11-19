import type { DoctypeSAXEventBaseInterface } from "./DoctypeSAXEventBaseInterface.js";

export interface DoctypeSAXEventPublicInterface extends DoctypeSAXEventBaseInterface {
  dtdType: "PUBLIC"
  /** public identifier */
  identifier: string
  /** uri reference */
  uri?: string
}
