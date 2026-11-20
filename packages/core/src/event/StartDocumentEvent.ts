import type { StartDocumentSAEventInterface } from "../event-interface/index.js";
import { SAEvent } from "./SAEvent.js";

/**
 * Event name constant for document start events.
 */
export const SA_START_DOCUMENT_EVENT_TYPE = "startDocument";

/**
 * Base event class representing the start of a document.
 */
export class StartDocumentEvent<KIND extends string> extends SAEvent<typeof SA_START_DOCUMENT_EVENT_TYPE> implements StartDocumentSAEventInterface<KIND> {
  kind: KIND;
  constructor(kind: KIND) {
    super(SA_START_DOCUMENT_EVENT_TYPE);
    this.kind = kind;
  }
}
