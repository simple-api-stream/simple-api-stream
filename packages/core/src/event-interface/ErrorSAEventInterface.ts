import type { SA_ERROR_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing an error event.
 */
export interface ErrorSAEventInterface {
  name: typeof SA_ERROR_EVENT_TYPE
  error: unknown
}
