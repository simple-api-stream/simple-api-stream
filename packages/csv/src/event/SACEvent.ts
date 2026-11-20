import { SAEvent } from "@simple-api-stream/core";

/**
 * Base class for all SAC (Simple API for CSV) events.
 */
export class SACEvent<T extends string> extends SAEvent<T> {}
