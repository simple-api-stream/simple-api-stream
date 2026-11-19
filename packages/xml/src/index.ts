export * as events from "./event/index.js";

export type * as eventInterfaces from "./event-interface/index.js";
export type * as interfaces from "./interface/index.js";

import * as XMLTextToSAXEventWritableStreamModule from "./XMLTextToSAXEventWritableStream.js";
import * as XMLTextToSAXTransformStreamModule from "./XMLTextToSAXTransformStream.js";
import * as ResolveToSAXReadableStreamModule from "./ResolveToSAXReadableStream.js";
import * as SAXToXMLTextTransformModule from "./SAXToXMLTextTransformStream.js";
import * as XMLTextToSAXParserModule from "./XMLTextToSAXParser.js";
export const streams = {
  ...XMLTextToSAXEventWritableStreamModule,
  ...XMLTextToSAXTransformStreamModule,
  ...ResolveToSAXReadableStreamModule,
  ...SAXToXMLTextTransformModule,
  ...XMLTextToSAXParserModule,
};
export { XMLTextToSAXEventWritableStream } from "./XMLTextToSAXEventWritableStream.js";
export { XMLTextToSAXTransformStream } from "./XMLTextToSAXTransformStream.js";
export { ResolveToSAXReadableStream } from "./ResolveToSAXReadableStream.js";
export { SAXToXMLTextTransformStream } from "./SAXToXMLTextTransformStream.js";
