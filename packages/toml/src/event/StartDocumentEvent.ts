import { StartDocumentEvent as BaseStartDocumentEvent } from "@simple-api-stream/core";
import type { StartDocumentSATEventInterface } from "../event-interface/index.js";

/**
 * Document kind identifier for SAT (`"toml"`) start-document events.
 */
export const SAT_START_DOCUMENT_EVENT_KIND = "toml";

/**
 * Event class representing the start of a TOML document.
 */
export class StartDocumentEvent extends BaseStartDocumentEvent<typeof SAT_START_DOCUMENT_EVENT_KIND> implements StartDocumentSATEventInterface {
  constructor() {
    super(SAT_START_DOCUMENT_EVENT_KIND);
  }
}
