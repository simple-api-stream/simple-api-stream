import type { StartDocumentSAEventInterface } from "@simple-api-stream/core";
import type { SAT_START_DOCUMENT_EVENT_KIND } from "../event/index.js";

/**
 * Type representing the start of a TOML document event.
 */
export type StartDocumentSATEventInterface = StartDocumentSAEventInterface<typeof SAT_START_DOCUMENT_EVENT_KIND>;
