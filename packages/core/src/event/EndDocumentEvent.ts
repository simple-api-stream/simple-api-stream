import type { EndDocumentSAEventInterface } from "../event-interface/index.js";
import { SAEvent } from "./SAEvent.js";

export const SA_END_DOCUMENT_EVENT_TYPE = "endDocument";
export class EndDocumentEvent extends SAEvent<typeof SA_END_DOCUMENT_EVENT_TYPE> implements EndDocumentSAEventInterface {
  constructor() {
    super(SA_END_DOCUMENT_EVENT_TYPE);
  }
}
