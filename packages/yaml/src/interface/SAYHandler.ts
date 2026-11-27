import type {
  AliasSAYEventInterface,
  CommentSAYEventInterface,
  EndDocumentSAYEventInterface,
  EndMappingSAYEventInterface,
  EndSequenceSAYEventInterface,
  KeySAYEventInterface,
  ScalarSAYEventInterface,
  StartDocumentSAYEventInterface,
  StartMappingSAYEventInterface,
  StartSequenceSAYEventInterface,
} from "../event-interface/index.js";

/**
 * Callback interface for consuming SAY (Simple API for YAML) events.
 */
export interface SAYHandler {
  onStartDocument: (arg: StartDocumentSAYEventInterface) => void
  onEndDocument: (arg: EndDocumentSAYEventInterface) => void
  onComment: (arg: CommentSAYEventInterface) => void
  onStartMapping: (arg: StartMappingSAYEventInterface) => void
  onEndMapping: (arg: EndMappingSAYEventInterface) => void
  onStartSequence: (arg: StartSequenceSAYEventInterface) => void
  onEndSequence: (arg: EndSequenceSAYEventInterface) => void
  onKey: (arg: KeySAYEventInterface) => void
  onScalar: (arg: ScalarSAYEventInterface) => void
  onAlias: (arg: AliasSAYEventInterface) => void
  onError: (err: unknown) => void
}
