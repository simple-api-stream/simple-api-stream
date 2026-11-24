export * as events from "./event/index.js";

export type * as eventInterfaces from "./event-interface/index.js";
export type * as interfaces from "./interface/index.js";

import * as ResolveToSATReadableStreamModule from "./ResolveToSATReadableStream.js";
import * as SATToObjectTransformStreamModule from "./SATToObjectTransformStream.js";
import * as SATToTOMLTextTransformStreamModule from "./SATToTOMLTextTransformStream.js";
import * as TOMLTextToSATEventWritableStreamModule from "./TOMLTextToSATEventWritableStream.js";
import * as TOMLTextToSATParserModule from "./TOMLTextToSATParser.js";
import * as TOMLTextToSATTransformStreamModule from "./TOMLTextToSATTransformStream.js";

/**
 * Namespace containing all TOML stream and parser classes.
 */
export const streams = {
  ...ResolveToSATReadableStreamModule,
  ...SATToObjectTransformStreamModule,
  ...SATToTOMLTextTransformStreamModule,
  ...TOMLTextToSATEventWritableStreamModule,
  ...TOMLTextToSATParserModule,
  ...TOMLTextToSATTransformStreamModule,
};

export { ResolveToSATReadableStream } from "./ResolveToSATReadableStream.js";
export { SATToObjectTransformStream } from "./SATToObjectTransformStream.js";
export { SATToTOMLTextTransformStream } from "./SATToTOMLTextTransformStream.js";
export { TOMLTextToSATEventWritableStream } from "./TOMLTextToSATEventWritableStream.js";
export { TOMLTextToSATTransformStream } from "./TOMLTextToSATTransformStream.js";
