import type { CommentSAJEventInterface, EndArraySAJEventInterface, EndDocumentSAJEventInterface, EndObjectSAJEventInterface, ErrorSAJEventInterface, KeySAJEventInterface, StartArraySAJEventInterface, StartDocumentSAJEventInterface, StartObjectSAJEventInterface, ValueBooleanSAJEventInterface, ValueNullSAJEventInterface, ValueNumberSAJEventInterface, ValueStringSAJEventInterface } from "../event-interface/index.js";

/**
 * Callback interface for consuming SAJ (Simple API for JSON) events.
 */
export interface SAJHandler {
  /**
   * Invoked when a JSON object starts.
   */
  onStartObject: (arg: StartObjectSAJEventInterface) => void
  /**
   * Invoked when a JSON object ends.
   */
  onEndObject: (arg: EndObjectSAJEventInterface) => void
  /**
   * Invoked when a JSON array starts.
   */
  onStartArray: (arg: StartArraySAJEventInterface) => void
  /**
   * Invoked when a JSON array ends.
   */
  onEndArray: (arg: EndArraySAJEventInterface) => void
  /**
   * Invoked for a JSON object property key.
   */
  onKey: (arg: KeySAJEventInterface) => void
  /**
   * Invoked for a JSON primitive value (`boolean`, `number`, `string`, or `null`).
   */
  onValue: (arg: ValueBooleanSAJEventInterface | ValueNumberSAJEventInterface | ValueStringSAJEventInterface | ValueNullSAJEventInterface) => void
  /**
   * Invoked for a JSONC comment.
   */
  onComment: (arg: CommentSAJEventInterface) => void
  /**
   * Invoked when an error occurs during parsing or streaming.
   */
  onError: (err: unknown) => void
  /**
   * Invoked when a parse error is emitted as an `ErrorEvent` (e.g., in `json-seq` mode).
   */
  onErrorEvent: (arg: ErrorSAJEventInterface) => void
  /**
   * Invoked when a JSON document starts.
   */
  onStartDocument: (arg: StartDocumentSAJEventInterface) => void
  /**
   * Invoked when a JSON document ends.
   */
  onEndDocument: (arg: EndDocumentSAJEventInterface) => void
}
