import type { StartDocumentSAEventInterface } from "@simple-api-stream/core";
import type { SSE_DOCUMENT_KIND } from "../event/index.js";

/**
 * Interface representing the start of an SSE document stream.
 */
export type StartDocumentSSEEventInterface = StartDocumentSAEventInterface<typeof SSE_DOCUMENT_KIND>;
