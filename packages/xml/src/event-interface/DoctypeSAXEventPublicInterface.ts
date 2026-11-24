import type { DoctypeSAXEventBaseInterface } from "./DoctypeSAXEventBaseInterface.js";

/**
 * Interface representing a `PUBLIC` XML DOCTYPE declaration event.
 */
export interface DoctypeSAXEventPublicInterface extends DoctypeSAXEventBaseInterface {
  dtdType: "PUBLIC"
  /** public identifier */
  identifier: string
  /** uri reference */
  uri?: string
}
