import { StartDocumentEvent as BaseStartDocumentEvent } from "@simple-api-stream/core";
import type { StartDocumentSSEEventInterface } from "../event-interface/index.js";

/**
 * Document kind discriminator for SSE (`"sse"`) start-document events.
 */
export const SSE_DOCUMENT_KIND = "sse";

/**
 * Event class representing the start of an SSE stream (`kind: "sse"`).
 */
export class StartDocumentEvent extends BaseStartDocumentEvent<typeof SSE_DOCUMENT_KIND> implements StartDocumentSSEEventInterface {
  constructor() {
    super(SSE_DOCUMENT_KIND);
  }
}
