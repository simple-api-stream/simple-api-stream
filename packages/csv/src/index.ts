export * as events from "./event/index.js";

export type * as eventInterfaces from "./event-interface/index.js";
export type * as interfaces from "./interface/index.js";

import * as CSVTextToSACEventWritableStreamModule from "./CSVTextToSACEventWritableStream.js";
import * as CSVTextToSACTransformStreamModule from "./CSVTextToSACTransformStream.js";
import * as ResolveToSACReadableStreamModule from "./ResolveToSACReadableStream.js";
import * as SACToCSVTextTransformStreamModule from "./SACToCSVTextTransformStream.js";
import * as CSVTextToSACParserModule from "./CSVTextToSACParser.js";

/**
 * Namespace containing all CSV stream and parser classes.
 */
export const streams = {
  ...CSVTextToSACEventWritableStreamModule,
  ...CSVTextToSACTransformStreamModule,
  ...ResolveToSACReadableStreamModule,
  ...SACToCSVTextTransformStreamModule,
  ...CSVTextToSACParserModule,
};

export { CSVTextToSACEventWritableStream } from "./CSVTextToSACEventWritableStream.js";
export { CSVTextToSACTransformStream } from "./CSVTextToSACTransformStream.js";
export { ResolveToSACReadableStream } from "./ResolveToSACReadableStream.js";
export { SACToCSVTextTransformStream } from "./SACToCSVTextTransformStream.js";
