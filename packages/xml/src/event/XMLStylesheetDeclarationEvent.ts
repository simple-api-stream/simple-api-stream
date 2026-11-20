import type { XMLStylesheetDeclarationSAXEventInterface } from "../event-interface/index.js";
import { ProcessingInstructionEvent } from "./ProcessingInstructionEvent.js";

/**
 * Target constant for XML stylesheet declaration processing instructions (`<?xml-stylesheet ...?>`).
 */
export const SAX_XML_DECLARATION_STYLESHEET_TARGET_TYPE = "xml-stylesheet";

/**
 * Event class representing an `<?xml-stylesheet ...?>` processing instruction.
 */
export class XMLStylesheetDeclarationEvent extends ProcessingInstructionEvent<typeof SAX_XML_DECLARATION_STYLESHEET_TARGET_TYPE> implements XMLStylesheetDeclarationSAXEventInterface {
  type: string;
  href: string;
  constructor({ target, contentType, href }: { target: typeof SAX_XML_DECLARATION_STYLESHEET_TARGET_TYPE, contentType: string, href: string }) {
    super(target, XMLStylesheetDeclarationEvent.#makeData(contentType, href));
    this.type = contentType;
    this.href = href;
  }

  static #makeData(contentType: string, href: string) {
    return `type="${contentType}" href="${href}"`;
  }
}
