import type { StartDocumentSAEventInterface } from "@simple-api-stream/core";
import type { SAX_START_DOCUMENT_EVENT_KIND } from "../event/index.js";
/**
 * Type representing the start of an XML document event.
 */
export type StartDocumentSAXEventInterface = StartDocumentSAEventInterface<typeof SAX_START_DOCUMENT_EVENT_KIND>;
