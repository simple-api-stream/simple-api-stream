import type {
  CommentEvent,
  EndDocumentEvent,
  EntryEvent,
  SectionEvent,
  StartDocumentEvent,
} from "../event/index.js";

/**
 * Imperative builder interface for emitting SAI (Simple API for INI) events.
 */
export interface SAIResolver {
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
   * Emits a section header (`[section]`) event.
   */
  section(...args: ConstructorParameters<typeof SectionEvent>): void
  /**
   * Emits a key-value entry (`key = value`) event.
   */
  entry(...args: ConstructorParameters<typeof EntryEvent>): void
}
