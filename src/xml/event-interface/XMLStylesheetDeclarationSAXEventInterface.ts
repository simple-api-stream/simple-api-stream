import { SAX_XML_DECLARATION_STYLESHEET_TARGET_TYPE } from "../event/index.js";
import type { ProcessingInstructionSAXEventInterface } from "./ProcessingInstructionSAXEventInterface.js";

export interface XMLStylesheetDeclarationSAXEventInterface extends ProcessingInstructionSAXEventInterface<typeof SAX_XML_DECLARATION_STYLESHEET_TARGET_TYPE> {
  type: string
  href: string
}
