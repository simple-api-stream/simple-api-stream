export * as events from "./event/index.js";

export type * as eventInterfaces from "./event-interface/index.js";
export type * as interfaces from "./interface/index.js";

import * as JSONTextToSAJEventWritableStreamModule from "./JSONTextToSAJEventWritableStream.js";
import * as ResolveToSAJReadableStreamModule from "./ResolveToSAJReadableStream.js";
import * as JSONTextToSAJTransformStreamModule from "./JSONTextToSAJTransformStream.js";
import * as SAJToObjectTransformStreamModule from "./SAJToObjectTransformStream.js";
import * as JSONTextToSAJParserModule from "./JSONTextToSAJParser.js";
import * as ObjectToSAJTransformStreamModule from "./ObjectToSAJTransformStream.js";
import * as SAJToJSONTextTransformStreamModule from "./SAJToJSONTextTransformStream.js";

export const streams = {
  ...JSONTextToSAJEventWritableStreamModule,
  ...ResolveToSAJReadableStreamModule,
  ...SAJToObjectTransformStreamModule,
  ...JSONTextToSAJParserModule,
  ...ObjectToSAJTransformStreamModule,
  ...SAJToJSONTextTransformStreamModule,
};
export const JSONTextToSAJEventWritableStream = JSONTextToSAJEventWritableStreamModule.JSONTextToSAJEventWritableStream;
export const ResolveToSAJReadableStream = ResolveToSAJReadableStreamModule.ResolveToSAJReadableStream;
export const JSONTextToSAJTransformStream = JSONTextToSAJTransformStreamModule.JSONTextToSAJTransformStream;
export const SAJToObjectTransformStream = SAJToObjectTransformStreamModule.SAJToObjectTransformStream;
export const ObjectToSAJTransformStream = ObjectToSAJTransformStreamModule.ObjectToSAJTransformStream;
export const SAJToJSONTextTransformStream = SAJToJSONTextTransformStreamModule.SAJToJSONTextTransformStream;
