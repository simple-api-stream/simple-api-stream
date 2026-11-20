import type { EndDocumentSAEventInterface } from "../event-interface/index.js";
import { SAEvent } from "./SAEvent.js";

/**
 * Event name constant for document end events.
 */
export const SA_END_DOCUMENT_EVENT_TYPE = "endDocument";

/**
 * Event class representing the end of a document.
 */
export class EndDocumentEvent extends SAEvent<typeof SA_END_DOCUMENT_EVENT_TYPE> implements EndDocumentSAEventInterface {
  constructor() {
    super(SA_END_DOCUMENT_EVENT_TYPE);
  }
}
