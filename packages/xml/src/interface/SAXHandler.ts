import type {
  EndElementSAXEventInterface,
  StartElementSAXEventInterface,
  TextSAXEventInterface,
  DoctypeSAXEventInterface,
  CdataSAXEventInterface,
  CommentSAXEventInterface,
  ProcessingInstructionSAXEventInterface,
  StartDocumentSAXEventInterface,
  EndDocumentSAXEventInterface,
} from "../event-interface/index.js";

/**
 * Callback interface for consuming SAX (Simple API for XML) events.
 */
export interface SAXHandler {
  /**
   * Invoked for an XML DOCTYPE declaration.
   */
  onDoctype: (arg: DoctypeSAXEventInterface) => void
  /**
   * Invoked when an XML element starts.
   */
  onStartElement: (arg: StartElementSAXEventInterface) => void
  /**
   * Invoked when an XML element ends.
   */
  onEndElement: (arg: EndElementSAXEventInterface) => void
  /**
   * Invoked for an XML text node.
   */
  onText: (arg: TextSAXEventInterface) => void
  /**
   * Invoked for an XML CDATA section.
   */
  onCdata: (arg: CdataSAXEventInterface) => void
  /**
   * Invoked for an XML comment.
   */
  onComment: (arg: CommentSAXEventInterface) => void
  /**
   * Invoked when an error occurs during parsing or streaming.
   */
  onError: (err: unknown) => void
  /**
   * Invoked for an XML processing instruction (including XML and stylesheet declarations).
   */
  onProcessingInstruction: (arg: ProcessingInstructionSAXEventInterface<string>) => void
  /**
   * Invoked when an XML document starts.
   */
  onStartDocument: (arg: StartDocumentSAXEventInterface) => void
  /**
   * Invoked when an XML document ends.
   */
  onEndDocument: (arg: EndDocumentSAXEventInterface) => void
}
