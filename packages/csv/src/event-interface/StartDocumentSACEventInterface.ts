import type { StartDocumentSAEventInterface } from "@simple-api-stream/core";
import type { SAC_START_DOCUMENT_EVENT_KIND } from "../event/index.js";

/**
 * Interface representing the start of a CSV document event.
 */
export type StartDocumentSACEventInterface = StartDocumentSAEventInterface<typeof SAC_START_DOCUMENT_EVENT_KIND>;
