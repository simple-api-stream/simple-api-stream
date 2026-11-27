import { StartDocumentEvent as BaseStartDocumentEvent } from "@simple-api-stream/core";
import type { StartDocumentSAYEventInterface } from "../event-interface/index.js";

/**
 * Document kind identifier for SAY (`"yaml"`) start-document events.
 */
export const SAY_START_DOCUMENT_EVENT_KIND = "yaml";

/**
 * Event class representing the start of a YAML document.
 */
export class StartDocumentEvent extends BaseStartDocumentEvent<typeof SAY_START_DOCUMENT_EVENT_KIND> implements StartDocumentSAYEventInterface {
  constructor() {
    super(SAY_START_DOCUMENT_EVENT_KIND);
  }
}
