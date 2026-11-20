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
  startDocument(...args: ConstructorParameters<typeof StartDocumentEvent>): void
  endDocument(...args: ConstructorParameters<typeof EndDocumentEvent>): void
  startHeaderRow(...args: ConstructorParameters<typeof StartHeaderRowEvent>): void
  endHeaderRow(...args: ConstructorParameters<typeof EndHeaderRowEvent>): void
  startRecordRow(...args: ConstructorParameters<typeof StartRecordRowEvent>): void
  endRecordRow(...args: ConstructorParameters<typeof EndRecordRowEvent>): void
  column(...args: ConstructorParameters<typeof ColumnEvent>): void
}
