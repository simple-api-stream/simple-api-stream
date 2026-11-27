import type {
  CommentSAIEventInterface,
  EndDocumentSAIEventInterface,
  EntrySAIEventInterface,
  SectionSAIEventInterface,
  StartDocumentSAIEventInterface,
} from "../event-interface/index.js";

/**
 * Callback interface for consuming SAI (Simple API for INI) events.
 */
export interface SAIHandler {
  /**
   * Invoked when an INI document starts.
   */
  onStartDocument: (arg: StartDocumentSAIEventInterface) => void
  /**
   * Invoked when an INI document ends.
   */
  onEndDocument: (arg: EndDocumentSAIEventInterface) => void
  /**
   * Invoked for an INI comment (`; ...` or `# ...`).
   */
  onComment: (arg: CommentSAIEventInterface) => void
  /**
   * Invoked for an INI section header (`[section]`).
   */
  onSection: (arg: SectionSAIEventInterface) => void
  /**
   * Invoked for an INI key-value entry (`key = value`).
   */
  onEntry: (arg: EntrySAIEventInterface) => void
  /**
   * Invoked when an error occurs during parsing or streaming.
   */
  onError: (err: unknown) => void
}
