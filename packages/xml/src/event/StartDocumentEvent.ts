import { StartDocumentEvent as BaseEvent } from "@simple-api-stream/core";
import type { StartDocumentSAXEventInterface } from "../event-interface/index.js";
/**
 * Document kind constant for SAX document start events.
 */
export const SAX_START_DOCUMENT_EVENT_KIND = "xml";

/**
 * Event class representing the start of an XML document.
 */
export class StartDocumentEvent extends BaseEvent<typeof SAX_START_DOCUMENT_EVENT_KIND> implements StartDocumentSAXEventInterface {
  constructor() {
    super(SAX_START_DOCUMENT_EVENT_KIND);
  }
}
