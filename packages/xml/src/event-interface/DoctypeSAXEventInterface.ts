import type { DoctypeSAXEventPublicInterface } from "./DoctypeSAXEventPublicInterface.js";
import type { DoctypeSAXEventSimpleInterface } from "./DoctypeSAXEventSimpleInterface.js";
import type { DoctypeSAXEventSystemInterface } from "./DoctypeSAXEventSystemInterface.js";

/**
 * Union type of all XML DOCTYPE declaration event interfaces.
 */
export type DoctypeSAXEventInterface = DoctypeSAXEventSimpleInterface | DoctypeSAXEventPublicInterface | DoctypeSAXEventSystemInterface;
