import { StartDocumentEvent as BaseEvent } from "../../event/index.js";
import type { StartDocumentSAXEventInterface } from "../event-interface/index.js";
export const SAX_START_DOCUMENT_EVENT_KIND = "xml";
export class StartDocumentEvent extends BaseEvent<typeof SAX_START_DOCUMENT_EVENT_KIND> implements StartDocumentSAXEventInterface {
  constructor() {
    super(SAX_START_DOCUMENT_EVENT_KIND);
  }
}
