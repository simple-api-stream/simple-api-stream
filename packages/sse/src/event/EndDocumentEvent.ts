import { EndDocumentEvent as BaseEndDocumentEvent } from "@simple-api-stream/core";
import type { EndDocumentSSEEventInterface } from "../event-interface/index.js";

/**
 * Event class representing the end of an SSE stream.
 */
export class EndDocumentEvent extends BaseEndDocumentEvent implements EndDocumentSSEEventInterface {}
