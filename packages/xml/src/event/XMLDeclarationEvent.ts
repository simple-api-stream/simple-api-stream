import type { XMLdeclarationSAXEventInterface } from "../event-interface/index.js";
import { ProcessingInstructionEvent } from "./ProcessingInstructionEvent.js";

/**
 * Target constant for XML declaration processing instructions (`<?xml ...?>`).
 */
export const SAX_XML_DECLARATION_TARGET_TYPE = "xml";

/**
 * Event class representing an XML declaration (`<?xml version="..." encoding="..." ?>`).
 */
export class XMLDeclarationEvent extends ProcessingInstructionEvent<typeof SAX_XML_DECLARATION_TARGET_TYPE> implements XMLdeclarationSAXEventInterface {
  version: string;
  encoding: string;
  standalone: "yes" | "no";
  constructor({ target, version = "1.0", encoding = "UTF-8", standalone = "yes" }: { target: typeof SAX_XML_DECLARATION_TARGET_TYPE, version?: string, encoding?: string, standalone?: "yes" | "no" }) {
    super(target, XMLDeclarationEvent.#makeData(version, encoding, standalone));
    this.version = version;
    this.encoding = encoding;
    this.standalone = standalone;
  }

  static #makeData(version: string, encoding: string, standalone: "yes" | "no" = "yes") {
    const joins: string[] = [
      `version="${version}"`,
      `encoding="${encoding}"`,
    ];
    if (standalone !== "yes")
      joins.push(`standalone="${standalone}"`);
    return joins.join(" ");
  }
}
