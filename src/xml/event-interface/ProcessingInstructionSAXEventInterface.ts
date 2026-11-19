import type { SAX_PROCESSING_INSTRUCTION_EVENT_TYPE } from "../event/index.js";

export interface ProcessingInstructionSAXEventInterface<T extends string = string> {
  name: typeof SAX_PROCESSING_INSTRUCTION_EVENT_TYPE
  target: T
  data: string
}
