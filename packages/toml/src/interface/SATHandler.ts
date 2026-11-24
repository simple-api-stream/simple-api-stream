import type {
  ArrayTableSATEventInterface,
  CommentSATEventInterface,
  EndArraySATEventInterface,
  EndDocumentSATEventInterface,
  EndInlineTableSATEventInterface,
  KeySATEventInterface,
  StartArraySATEventInterface,
  StartDocumentSATEventInterface,
  StartInlineTableSATEventInterface,
  TableSATEventInterface,
  ValueSATEventInterface,
} from "../event-interface/index.js";

/**
 * Callback interface for consuming SAT (Simple API for TOML) events.
 */
export interface SATHandler {
  /**
   * Invoked when a TOML document starts.
   */
  onStartDocument: (arg: StartDocumentSATEventInterface) => void
  /**
   * Invoked when a TOML document ends.
   */
  onEndDocument: (arg: EndDocumentSATEventInterface) => void
  /**
   * Invoked for a TOML comment (`# ...`).
   */
  onComment: (arg: CommentSATEventInterface) => void
  /**
   * Invoked for a TOML standard table header (`[a.b]`).
   */
  onTable: (arg: TableSATEventInterface) => void
  /**
   * Invoked for a TOML array-of-tables header (`[[a.b]]`).
   */
  onArrayTable: (arg: ArrayTableSATEventInterface) => void
  /**
   * Invoked for a TOML key or dotted key (`a.b = ...`).
   */
  onKey: (arg: KeySATEventInterface) => void
  /**
   * Invoked when a TOML inline table (`{ ... }`) starts.
   */
  onStartInlineTable: (arg: StartInlineTableSATEventInterface) => void
  /**
   * Invoked when a TOML inline table (`{ ... }`) ends.
   */
  onEndInlineTable: (arg: EndInlineTableSATEventInterface) => void
  /**
   * Invoked when a TOML array (`[ ... ]`) starts.
   */
  onStartArray: (arg: StartArraySATEventInterface) => void
  /**
   * Invoked when a TOML array (`[ ... ]`) ends.
   */
  onEndArray: (arg: EndArraySATEventInterface) => void
  /**
   * Invoked for a TOML primitive value.
   */
  onValue: (arg: ValueSATEventInterface) => void
  /**
   * Invoked when an error occurs during parsing or streaming.
   */
  onError: (err: unknown) => void
}
