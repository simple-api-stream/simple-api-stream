import type { ErrorSAEventInterface } from "../event-interface/index.js";
import { SAEvent } from "./SAEvent.js";

/**
 * Event name constant for error events.
 */
export const SA_ERROR_EVENT_TYPE = "error";

/**
 * Base event class representing an error event.
 */
export class ErrorEvent extends SAEvent<typeof SA_ERROR_EVENT_TYPE> implements ErrorSAEventInterface {
  error: unknown;
  constructor(error: unknown) {
    super(SA_ERROR_EVENT_TYPE);
    this.error = error;
  }
}
