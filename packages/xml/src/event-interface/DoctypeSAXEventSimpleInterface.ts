import type { DoctypeSAXEventBaseInterface } from "./DoctypeSAXEventBaseInterface.js";

/**
 * Interface representing a simple XML DOCTYPE declaration event without `PUBLIC` or `SYSTEM` identifiers.
 */
export interface DoctypeSAXEventSimpleInterface extends DoctypeSAXEventBaseInterface {
  dtdType?: undefined
}
