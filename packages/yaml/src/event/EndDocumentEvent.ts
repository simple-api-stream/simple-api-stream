import { EndDocumentEvent as BaseEndDocumentEvent } from "@simple-api-stream/core";
import type { EndDocumentSAYEventInterface } from "../event-interface/index.js";

/**
 * Event class representing the end of a YAML document.
 */
export class EndDocumentEvent extends BaseEndDocumentEvent implements EndDocumentSAYEventInterface {}
