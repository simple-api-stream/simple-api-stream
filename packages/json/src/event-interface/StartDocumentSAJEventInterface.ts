import type { StartDocumentSAEventInterface } from "@simple-api-stream/core";
import type { SAJ_START_DOCUMENT_EVENT_KIND } from "../event/index.js";
/**
 * Type representing the start of a JSON document event.
 */
export type StartDocumentSAJEventInterface = StartDocumentSAEventInterface<typeof SAJ_START_DOCUMENT_EVENT_KIND>;
