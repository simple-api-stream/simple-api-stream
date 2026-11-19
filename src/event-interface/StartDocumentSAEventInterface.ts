import type { SA_START_DOCUMENT_EVENT_TYPE } from "../event/index.js";

export interface StartDocumentSAEventInterface<KIND extends string> {
  name: typeof SA_START_DOCUMENT_EVENT_TYPE
  kind: KIND
}
