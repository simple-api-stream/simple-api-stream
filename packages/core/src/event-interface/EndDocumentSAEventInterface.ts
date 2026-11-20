import type { SA_END_DOCUMENT_EVENT_TYPE } from "../event/index.js";

/**
 * Interface representing the end of a document event.
 */
export interface EndDocumentSAEventInterface {
  name: typeof SA_END_DOCUMENT_EVENT_TYPE
}
