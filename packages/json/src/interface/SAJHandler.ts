import type { EndArraySAJEventInterface, EndDocumentSAJEventInterface, EndObjectSAJEventInterface, ErrorSAJEventInterface, KeySAJEventInterface, StartArraySAJEventInterface, StartDocumentSAJEventInterface, StartObjectSAJEventInterface, ValueBooleanSAJEventInterface, ValueNullSAJEventInterface, ValueNumberSAJEventInterface, ValueStringSAJEventInterface } from "../event-interface/index.js";

export interface SAJHandler {
  onStartObject: (arg: StartObjectSAJEventInterface) => void
  onEndObject: (arg: EndObjectSAJEventInterface) => void
  onStartArray: (arg: StartArraySAJEventInterface) => void
  onEndArray: (arg: EndArraySAJEventInterface) => void
  onKey: (arg: KeySAJEventInterface) => void
  onValue: (arg: ValueBooleanSAJEventInterface | ValueNumberSAJEventInterface | ValueStringSAJEventInterface | ValueNullSAJEventInterface) => void
  onError: (err: unknown) => void
  onErrorEvent: (arg: ErrorSAJEventInterface) => void
  onStartDocument: (arg: StartDocumentSAJEventInterface) => void
  onEndDocument: (arg: EndDocumentSAJEventInterface) => void
}
