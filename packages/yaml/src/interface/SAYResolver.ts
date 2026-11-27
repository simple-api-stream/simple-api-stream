import type {
  AliasEvent,
  CommentEvent,
  EndDocumentEvent,
  EndMappingEvent,
  EndSequenceEvent,
  KeyEvent,
  ScalarEvent,
  StartDocumentEvent,
  StartMappingEvent,
  StartSequenceEvent,
} from "../event/index.js";
import type { ScalarValueType } from "../event-interface/index.js";

/**
 * Imperative builder interface for emitting SAY (Simple API for YAML) events.
 */
export interface SAYResolver {
  startDocument(...args: ConstructorParameters<typeof StartDocumentEvent>): void
  endDocument(...args: ConstructorParameters<typeof EndDocumentEvent>): void
  comment(...args: ConstructorParameters<typeof CommentEvent>): void
  startMapping(...args: ConstructorParameters<typeof StartMappingEvent>): void
  endMapping(...args: ConstructorParameters<typeof EndMappingEvent>): void
  startSequence(...args: ConstructorParameters<typeof StartSequenceEvent>): void
  endSequence(...args: ConstructorParameters<typeof EndSequenceEvent>): void
  key(...args: ConstructorParameters<typeof KeyEvent>): void
  scalar<VT extends ScalarValueType>(...args: ConstructorParameters<typeof ScalarEvent<VT>>): void
  alias(...args: ConstructorParameters<typeof AliasEvent>): void
}
