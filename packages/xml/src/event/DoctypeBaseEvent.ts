import type { DoctypeSAXEventBaseInterface } from "../event-interface/index.js";
import { SAXEvent } from "./SAXEvent.js";

/**
 * Event name constant for XML DOCTYPE declaration events.
 */
export const SAX_DOCTYPE_EVENT_TYPE = "doctype";

/**
 * Base event class representing an XML `<!DOCTYPE ...>` declaration.
 */
export class DoctypeBaseEvent extends SAXEvent<typeof SAX_DOCTYPE_EVENT_TYPE> implements DoctypeSAXEventBaseInterface {
  root: string;
  declarations?: string[];
  constructor(root: string, options?: {
    declarations?: string[]
  }) {
    super(SAX_DOCTYPE_EVENT_TYPE);
    this.root = root;
    this.declarations = (options?.declarations?.length ?? 0) > 0 ? options?.declarations : undefined;
  }
}
