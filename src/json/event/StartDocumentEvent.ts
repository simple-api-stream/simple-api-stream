import { StartDocumentEvent as BaseEvent } from "../../event/index.js";
import type { StartDocumentSAJEventInterface } from "../event-interface/index.js";
export const SAJ_START_DOCUMENT_EVENT_KIND = "json";
export class StartDocumentEvent extends BaseEvent<typeof SAJ_START_DOCUMENT_EVENT_KIND> implements StartDocumentSAJEventInterface {
  constructor() {
    super(SAJ_START_DOCUMENT_EVENT_KIND);
  }
}
