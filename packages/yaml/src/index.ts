export * as events from "./event/index.js";

export type * as eventInterfaces from "./event-interface/index.js";
export type * as interfaces from "./interface/index.js";

import * as ObjectToSAYTransformStreamModule from "./ObjectToSAYTransformStream.js";
import * as ResolveToSAYReadableStreamModule from "./ResolveToSAYReadableStream.js";
import * as SAYToObjectTransformStreamModule from "./SAYToObjectTransformStream.js";
import * as SAYToYAMLTextTransformStreamModule from "./SAYToYAMLTextTransformStream.js";
import * as YAMLTextToSAYEventWritableStreamModule from "./YAMLTextToSAYEventWritableStream.js";
import * as YAMLTextToSAYParserModule from "./YAMLTextToSAYParser.js";
import * as YAMLTextToSAYTransformStreamModule from "./YAMLTextToSAYTransformStream.js";

/**
 * Namespace containing all YAML stream and parser classes.
 */
export const streams = {
  ...ObjectToSAYTransformStreamModule,
  ...ResolveToSAYReadableStreamModule,
  ...SAYToObjectTransformStreamModule,
  ...SAYToYAMLTextTransformStreamModule,
  ...YAMLTextToSAYEventWritableStreamModule,
  ...YAMLTextToSAYParserModule,
  ...YAMLTextToSAYTransformStreamModule,
};

export { ObjectToSAYTransformStream } from "./ObjectToSAYTransformStream.js";
export { ResolveToSAYReadableStream } from "./ResolveToSAYReadableStream.js";
export { SAYToObjectTransformStream } from "./SAYToObjectTransformStream.js";
export { SAYToYAMLTextTransformStream } from "./SAYToYAMLTextTransformStream.js";
export { YAMLTextToSAYEventWritableStream } from "./YAMLTextToSAYEventWritableStream.js";
export { YAMLTextToSAYTransformStream } from "./YAMLTextToSAYTransformStream.js";
export { parseYAMLResponse, type ParseYAMLResponseOptions } from "./parseYAMLResponse.js";
export type {
  ObjectToSAYTransformStreamOptions,
  ObjectToSAYUnsupportedHandler,
} from "./ObjectToSAYTransformStream.js";
export type { SAYToObjectTransformStreamOptions } from "./SAYToObjectTransformStream.js";
export type { SAYToYAMLTextTransformStreamOptions } from "./SAYToYAMLTextTransformStream.js";
export type {
  YAMLTextToSAYParserAdditionalHandler,
  YAMLTextToSAYParserOptions,
} from "./YAMLTextToSAYParser.js";
