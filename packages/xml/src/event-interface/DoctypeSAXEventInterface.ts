import type { DoctypeSAXEventPublicInterface } from "./DoctypeSAXEventPublicInterface.js";
import type { DoctypeSAXEventSimpleInterface } from "./DoctypeSAXEventSimpleInterface.js";
import type { DoctypeSAXEventSystemInterface } from "./DoctypeSAXEventSystemInterface.js";

export type DoctypeSAXEventInterface = DoctypeSAXEventSimpleInterface | DoctypeSAXEventPublicInterface | DoctypeSAXEventSystemInterface;
