export * as interfaces from "./interface/index.js";

// #region xml
import * as xml from "./xml/index.js";
export {
  xml as xml,
};
export const XMLTextToSAXEventWritableStream = xml.XMLTextToSAXEventWritableStream;
export const XMLTextToSAXTransformStream = xml.XMLTextToSAXTransformStream;
export const ResolveToSAXReadableStream = xml.ResolveToSAXReadableStream;
export const SAXToXMLTextTransform = xml.SAXToXMLTextTransform;
// #endregion

// #region json
import * as json from "./json/index.js";
export {
  json as json,
};
export const JSONTextToSAJEventWritableStream = json.JSONTextToSAJEventWritableStream;
export const ResolveToSAJReadableStream = json.ResolveToSAJReadableStream;
export const JSONTextToSAJTransformStream = json.JSONTextToSAJTransformStream;
export const SAJToObjectTransformStream = json.SAJToObjectTransformStream;
export const ObjectToSAJTransformStream = json.ObjectToSAJTransformStream;
// #endregion
