import { EndDocumentEvent as BaseEndDocumentEvent } from "@simple-api-stream/core";
import type { EndDocumentSAIEventInterface } from "../event-interface/index.js";

/**
 * Event class representing the end of an INI document.
 */
export class EndDocumentEvent extends BaseEndDocumentEvent implements EndDocumentSAIEventInterface {}
