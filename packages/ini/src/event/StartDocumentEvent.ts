import { StartDocumentEvent as BaseStartDocumentEvent } from "@simple-api-stream/core";
import type { StartDocumentSAIEventInterface } from "../event-interface/index.js";

/**
 * Document kind identifier for SAI (`"ini"`) start-document events.
 */
export const SAI_START_DOCUMENT_EVENT_KIND = "ini";

/**
 * Event class representing the start of an INI document.
 */
export class StartDocumentEvent extends BaseStartDocumentEvent<typeof SAI_START_DOCUMENT_EVENT_KIND> implements StartDocumentSAIEventInterface {
  constructor() {
    super(SAI_START_DOCUMENT_EVENT_KIND);
  }
}
