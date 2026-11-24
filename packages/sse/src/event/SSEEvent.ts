import { SAEvent } from "@simple-api-stream/core";
import type { SSEEventInterface } from "../event-interface/index.js";

/**
 * Base class for SSE (Server-Sent Events) event objects.
 */
export class SSEEvent<T extends SSEEventInterface["name"]> extends SAEvent<T> {}
