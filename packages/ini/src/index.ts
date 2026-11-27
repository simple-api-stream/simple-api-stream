export * as events from "./event/index.js";

export type * as eventInterfaces from "./event-interface/index.js";
export type * as interfaces from "./interface/index.js";

import * as INITextToSAIEventWritableStreamModule from "./INITextToSAIEventWritableStream.js";
import * as INITextToSAIParserModule from "./INITextToSAIParser.js";
import * as INITextToSAITransformStreamModule from "./INITextToSAITransformStream.js";
import * as ObjectToSAITransformStreamModule from "./ObjectToSAITransformStream.js";
import * as ResolveToSAIReadableStreamModule from "./ResolveToSAIReadableStream.js";
import * as SAIToINITextTransformStreamModule from "./SAIToINITextTransformStream.js";
import * as SAIToObjectTransformStreamModule from "./SAIToObjectTransformStream.js";

/**
 * Namespace containing all INI stream and parser classes.
 */
export const streams = {
  ...INITextToSAIEventWritableStreamModule,
  ...INITextToSAIParserModule,
  ...INITextToSAITransformStreamModule,
  ...ObjectToSAITransformStreamModule,
  ...ResolveToSAIReadableStreamModule,
  ...SAIToINITextTransformStreamModule,
  ...SAIToObjectTransformStreamModule,
};

export { INITextToSAIEventWritableStream } from "./INITextToSAIEventWritableStream.js";
export { INITextToSAITransformStream } from "./INITextToSAITransformStream.js";
export { ObjectToSAITransformStream } from "./ObjectToSAITransformStream.js";
export { ResolveToSAIReadableStream } from "./ResolveToSAIReadableStream.js";
export { SAIToINITextTransformStream } from "./SAIToINITextTransformStream.js";
export { SAIToObjectTransformStream } from "./SAIToObjectTransformStream.js";
export { parseINIResponse, type ParseINIResponseOptions } from "./parseINIResponse.js";
export type {
  INITextToSAIParserAdditionalHandler,
  INITextToSAIParserOptions,
} from "./INITextToSAIParser.js";
export type {
  ObjectToSAITransformStreamOptions,
  ObjectToSAIUnsupportedHandler,
} from "./ObjectToSAITransformStream.js";
export type { SAIToINITextTransformStreamOptions } from "./SAIToINITextTransformStream.js";
export type { INIObject } from "./SAIToObjectTransformStream.js";
