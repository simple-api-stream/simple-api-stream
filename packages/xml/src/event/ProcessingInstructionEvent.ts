import type { ProcessingInstructionSAXEventInterface } from "../event-interface/index.js";
import { SAXEvent } from "./SAXEvent.js";

/**
 * Event name constant for XML processing instruction events.
 */
export const SAX_PROCESSING_INSTRUCTION_EVENT_TYPE = "processingInstruction";

/**
 * Event class representing an XML processing instruction (`<?target data?>`).
 */
export class ProcessingInstructionEvent<T extends string = string> extends SAXEvent<typeof SAX_PROCESSING_INSTRUCTION_EVENT_TYPE> implements ProcessingInstructionSAXEventInterface<T> {
  target: T;
  data: string;
  constructor(target: T, data: string) {
    super(SAX_PROCESSING_INSTRUCTION_EVENT_TYPE);
    this.target = target;
    this.data = data;
  }
}
