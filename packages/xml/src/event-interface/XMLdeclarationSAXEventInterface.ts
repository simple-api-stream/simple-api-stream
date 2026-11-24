import { SAX_XML_DECLARATION_TARGET_TYPE } from "../event/index.js";
import type { ProcessingInstructionSAXEventInterface } from "./ProcessingInstructionSAXEventInterface.js";

/**
 * Interface representing an XML declaration (`<?xml ...?>`) processing instruction event.
 */
export interface XMLdeclarationSAXEventInterface extends ProcessingInstructionSAXEventInterface<typeof SAX_XML_DECLARATION_TARGET_TYPE> {
  version: string
  encoding: string
  standalone: "yes" | "no"
}
