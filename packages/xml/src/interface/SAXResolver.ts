import type { CdataEvent, CommentEvent, XMLStylesheetDeclarationEvent, EndElementEvent, StartElementEvent, TextEvent, XMLDeclarationEvent, DoctypePublicEvent, DoctypeSimpleEvent, DoctypeSystemEvent, ProcessingInstructionEvent, StartDocumentEvent, EndDocumentEvent } from "../event/index.js";
/**
 * Imperative builder interface for emitting SAX (Simple API for XML) events.
 */
export interface SAXResolver {
  /**
   * Emits a CDATA section event.
   */
  cdata(...args: ConstructorParameters<typeof CdataEvent>): void
  /**
   * Emits a comment event.
   */
  comment(...args: ConstructorParameters<typeof CommentEvent>): void
  /**
   * Emits a DOCTYPE declaration event.
   */
  doctype(...args: ConstructorParameters<typeof DoctypePublicEvent | typeof DoctypeSimpleEvent | typeof DoctypeSystemEvent>): void
  /**
   * Emits an end-element event.
   */
  endElement(...args: ConstructorParameters<typeof EndElementEvent>): void
  /**
   * Emits a start-element event.
   */
  startElement(...args: ConstructorParameters<typeof StartElementEvent>): void
  /**
   * Emits a text node event.
   */
  text(...args: ConstructorParameters<typeof TextEvent>): void
  /**
   * Emits a processing instruction event (including XML and stylesheet declarations).
   */
  processingInstruction(...args: ConstructorParameters<typeof ProcessingInstructionEvent | typeof XMLDeclarationEvent | typeof XMLStylesheetDeclarationEvent>): void
  /**
   * Emits a start-document event.
   */
  startDocument(...args: ConstructorParameters<typeof StartDocumentEvent>): void
  /**
   * Emits an end-document event.
   */
  endDocument(...args: ConstructorParameters<typeof EndDocumentEvent>): void
}
