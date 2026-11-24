import type {
  ColumnEvent,
  EndDocumentEvent,
  EndHeaderRowEvent,
  EndRecordRowEvent,
  StartDocumentEvent,
  StartHeaderRowEvent,
  StartRecordRowEvent,
} from "../event/index.js";

/**
 * Imperative builder interface for emitting SAC (Simple API for CSV) events.
 */
export interface SACResolver {
  /**
   * Emits a start-document event.
   */
  startDocument(...args: ConstructorParameters<typeof StartDocumentEvent>): void
  /**
   * Emits an end-document event.
   */
  endDocument(...args: ConstructorParameters<typeof EndDocumentEvent>): void
  /**
   * Emits a start-header-row event.
   */
  startHeaderRow(...args: ConstructorParameters<typeof StartHeaderRowEvent>): void
  /**
   * Emits an end-header-row event.
   */
  endHeaderRow(...args: ConstructorParameters<typeof EndHeaderRowEvent>): void
  /**
   * Emits a start-record-row event.
   */
  startRecordRow(...args: ConstructorParameters<typeof StartRecordRowEvent>): void
  /**
   * Emits an end-record-row event.
   */
  endRecordRow(...args: ConstructorParameters<typeof EndRecordRowEvent>): void
  /**
   * Emits a column (cell) event.
   */
  column(...args: ConstructorParameters<typeof ColumnEvent>): void
}
