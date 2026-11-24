import type { CommentEvent, EndArrayEvent, EndDocumentEvent, EndObjectEvent, KeyEvent, StartArrayEvent, StartDocumentEvent, StartObjectEvent, ValueEvent } from "../event/index.js";

/**
 * Imperative builder interface for emitting SAJ (Simple API for JSON) events.
 */
export interface SAJResolver {
  /**
   * Emits a start-object event.
   */
  startObject(...args: ConstructorParameters<typeof StartObjectEvent>): void
  /**
   * Emits an end-object event.
   */
  endObject(...args: ConstructorParameters<typeof EndObjectEvent>): void
  /**
   * Emits a start-array event.
   */
  startArray(...args: ConstructorParameters<typeof StartArrayEvent>): void
  /**
   * Emits an end-array event.
   */
  endArray(...args: ConstructorParameters<typeof EndArrayEvent>): void
  /**
   * Emits an object property key event.
   */
  key(...args: ConstructorParameters<typeof KeyEvent>): void
  /**
   * Emits a typed JSON primitive value event.
   */
  value<T extends "string" | "number" | "null" | "boolean">(...args: ConstructorParameters<typeof ValueEvent<T>>): void
  /**
   * Emits a JSONC comment event.
   */
  comment(...args: ConstructorParameters<typeof CommentEvent>): void
  /**
   * Emits a start-document event.
   */
  startDocument(...args: ConstructorParameters<typeof StartDocumentEvent>): void
  /**
   * Emits an end-document event.
   */
  endDocument(...args: ConstructorParameters<typeof EndDocumentEvent>): void
}
