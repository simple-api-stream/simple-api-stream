export * as events from "./event/index.js";

export type * as eventInterfaces from "./event-interface/index.js";
export type * as interfaces from "./interface/index.js";

import * as DOMToSAXTransformStreamModule from "./DOMToSAXTransformStream.js";
import * as ObjectToSAXTransformStreamModule from "./ObjectToSAXTransformStream.js";
import * as XMLTextToSAXEventWritableStreamModule from "./XMLTextToSAXEventWritableStream.js";
import * as XMLTextToSAXTransformStreamModule from "./XMLTextToSAXTransformStream.js";
import * as ResolveToSAXReadableStreamModule from "./ResolveToSAXReadableStream.js";
import * as SAXToObjectTransformStreamModule from "./SAXToObjectTransformStream.js";
import * as SAXToXMLTextTransformModule from "./SAXToXMLTextTransformStream.js";
import * as XMLTextToSAXParserModule from "./XMLTextToSAXParser.js";
/**
 * Namespace containing all XML stream and parser classes.
 */
export const streams = {
  ...DOMToSAXTransformStreamModule,
  ...ObjectToSAXTransformStreamModule,
  ...XMLTextToSAXEventWritableStreamModule,
  ...XMLTextToSAXTransformStreamModule,
  ...ResolveToSAXReadableStreamModule,
  ...SAXToObjectTransformStreamModule,
  ...SAXToXMLTextTransformModule,
  ...XMLTextToSAXParserModule,
};
export { DOMToSAXTransformStream } from "./DOMToSAXTransformStream.js";
export { ObjectToSAXTransformStream } from "./ObjectToSAXTransformStream.js";
export { XMLTextToSAXEventWritableStream } from "./XMLTextToSAXEventWritableStream.js";
export { XMLTextToSAXTransformStream } from "./XMLTextToSAXTransformStream.js";
export { ResolveToSAXReadableStream } from "./ResolveToSAXReadableStream.js";
export { SAXToObjectTransformStream } from "./SAXToObjectTransformStream.js";
export { SAXToXMLTextTransformStream } from "./SAXToXMLTextTransformStream.js";
export type {
  DOMAttrLike,
  DOMNodeLike,
  DOMToSAXTransformStreamOptions,
} from "./DOMToSAXTransformStream.js";
export type {
  ObjectToSAXNodeContext,
  ObjectToSAXNodeMapper,
  ObjectToSAXTransformStreamOptions,
} from "./ObjectToSAXTransformStream.js";
export type {
  SAXToObjectDocumentContext,
  SAXToObjectDocumentMapper,
  SAXToObjectTransformStreamOptions,
} from "./SAXToObjectTransformStream.js";
export type {
  XMLCdataNode,
  XMLChildNode,
  XMLCommentNode,
  XMLDoctypeNode,
  XMLDocumentNode,
  XMLElementNode,
  XMLNode,
  XMLProcessingInstructionNode,
  XMLTextNode,
} from "./node.js";
