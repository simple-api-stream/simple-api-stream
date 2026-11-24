/**
 * Plain-object representation of an XML document node.
 */
export type XMLDocumentNode = {
  type: "document"
  children: XMLChildNode[]
};

/**
 * Plain-object representation of an XML element node.
 */
export type XMLElementNode = {
  type: "element"
  tagName: string
  attrs: Record<string, string>
  children: XMLChildNode[]
  selfClosing?: boolean
};

/**
 * Plain-object representation of an XML text node.
 */
export type XMLTextNode = {
  type: "text"
  text: string
};

/**
 * Plain-object representation of an XML CDATA section node.
 */
export type XMLCdataNode = {
  type: "cdata"
  cdata: string
};

/**
 * Plain-object representation of an XML comment node.
 */
export type XMLCommentNode = {
  type: "comment"
  comment: string
};

/**
 * Plain-object representation of an XML processing instruction node.
 */
export type XMLProcessingInstructionNode = {
  type: "processingInstruction"
  target: string
  data: string
  version?: string
  encoding?: string
  standalone?: "yes" | "no"
  contentType?: string
  href?: string
};

/**
 * Plain-object representation of an XML DOCTYPE declaration node.
 */
export type XMLDoctypeNode =
  | {
    type: "doctype"
    root: string
    dtdType?: undefined
    declarations?: string[]
  }
  | {
    type: "doctype"
    root: string
    dtdType: "PUBLIC"
    identifier: string
    uri?: string
    declarations?: string[]
  }
  | {
    type: "doctype"
    root: string
    dtdType: "SYSTEM"
    uri: string
    declarations?: string[]
  };

/**
 * Union of all XML child node types.
 */
export type XMLChildNode =
  | XMLElementNode
  | XMLTextNode
  | XMLCdataNode
  | XMLCommentNode
  | XMLProcessingInstructionNode
  | XMLDoctypeNode;

/**
 * Union of all XML AST node types (document and child nodes).
 */
export type XMLNode = XMLDocumentNode | XMLChildNode;
