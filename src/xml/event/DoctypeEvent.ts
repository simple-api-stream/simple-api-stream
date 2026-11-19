import { DoctypePublicEvent } from "./DoctypePublicEvent.js";
import { DoctypeSimpleEvent } from "./DoctypeSimpleEvent.js";
import { DoctypeSystemEvent } from "./DoctypeSystemEvent.js";

export type DoctypeEvent = typeof DoctypePublicEvent | typeof DoctypeSimpleEvent | typeof DoctypeSystemEvent;
