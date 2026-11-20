import { DoctypePublicEvent } from "./DoctypePublicEvent.js";
import { DoctypeSimpleEvent } from "./DoctypeSimpleEvent.js";
import { DoctypeSystemEvent } from "./DoctypeSystemEvent.js";

/**
 * Union of DOCTYPE event constructor types.
 */
export type DoctypeEvent = typeof DoctypePublicEvent | typeof DoctypeSimpleEvent | typeof DoctypeSystemEvent;
