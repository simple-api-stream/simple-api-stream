import type {
  ArrayTableEvent,
  CommentEvent,
  EndArrayEvent,
  EndDocumentEvent,
  EndInlineTableEvent,
  KeyEvent,
  StartArrayEvent,
  StartDocumentEvent,
  StartInlineTableEvent,
  TableEvent,
  ValueEvent,
} from "../event/index.js";
import type { ValueType } from "../event-interface/index.js";

/**
 * Imperative builder interface for emitting SAT (Simple API for TOML) events.
 */
export interface SATResolver {
  /**
   * Emits a start-document event.
   */
  startDocument(...args: ConstructorParameters<typeof StartDocumentEvent>): void
  /**
   * Emits an end-document event.
   */
  endDocument(...args: ConstructorParameters<typeof EndDocumentEvent>): void
  /**
   * Emits a comment event.
   */
  comment(...args: ConstructorParameters<typeof CommentEvent>): void
  /**
   * Emits a standard table header (`[a.b]`) event.
   */
  table(...args: ConstructorParameters<typeof TableEvent>): void
  /**
   * Emits an array-of-tables header (`[[a.b]]`) event.
   */
  arrayTable(...args: ConstructorParameters<typeof ArrayTableEvent>): void
  /**
   * Emits a key or dotted key event.
   */
  key(...args: ConstructorParameters<typeof KeyEvent>): void
  /**
   * Emits a start-inline-table event.
   */
  startInlineTable(...args: ConstructorParameters<typeof StartInlineTableEvent>): void
  /**
   * Emits an end-inline-table event.
   */
  endInlineTable(...args: ConstructorParameters<typeof EndInlineTableEvent>): void
  /**
   * Emits a start-array event.
   */
  startArray(...args: ConstructorParameters<typeof StartArrayEvent>): void
  /**
   * Emits an end-array event.
   */
  endArray(...args: ConstructorParameters<typeof EndArrayEvent>): void
  /**
   * Emits a typed TOML primitive value event.
   */
  value<VT extends ValueType>(...args: ConstructorParameters<typeof ValueEvent<VT>>): void
}
