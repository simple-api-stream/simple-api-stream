import { EndDocumentEvent as BaseEndDocumentEvent } from "@simple-api-stream/core";
import type { EndDocumentSATEventInterface } from "../event-interface/index.js";

/**
 * Event class representing the end of a TOML document.
 */
export class EndDocumentEvent extends BaseEndDocumentEvent implements EndDocumentSATEventInterface {}
