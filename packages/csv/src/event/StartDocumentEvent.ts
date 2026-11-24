import { StartDocumentEvent as BaseEvent } from "@simple-api-stream/core";
import type { StartDocumentSACEventInterface } from "../event-interface/index.js";

/**
 * Document kind constant for SAC document start events.
 */
export const SAC_START_DOCUMENT_EVENT_KIND = "csv";

/**
 * Event class representing the start of a CSV document.
 */
export class StartDocumentEvent extends BaseEvent<typeof SAC_START_DOCUMENT_EVENT_KIND> implements StartDocumentSACEventInterface {
  constructor() {
    super(SAC_START_DOCUMENT_EVENT_KIND);
  }
}
