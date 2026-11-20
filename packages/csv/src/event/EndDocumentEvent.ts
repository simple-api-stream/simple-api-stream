import { EndDocumentEvent as BaseEvent } from "@simple-api-stream/core";
import type { EndDocumentSACEventInterface } from "../event-interface/index.js";

/**
 * Event class representing the end of a CSV document.
 */
export class EndDocumentEvent extends BaseEvent implements EndDocumentSACEventInterface {}
