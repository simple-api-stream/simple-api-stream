import type { CommentSAIEventInterface } from "./CommentSAIEventInterface.js";
import type { EndDocumentSAIEventInterface } from "./EndDocumentSAIEventInterface.js";
import type { EntrySAIEventInterface } from "./EntrySAIEventInterface.js";
import type { SectionSAIEventInterface } from "./SectionSAIEventInterface.js";
import type { StartDocumentSAIEventInterface } from "./StartDocumentSAIEventInterface.js";

/**
 * Union type of all SAI (Simple API for INI) event interfaces.
 */
export type SAIEventInterface
  = StartDocumentSAIEventInterface
    | EndDocumentSAIEventInterface
    | CommentSAIEventInterface
    | SectionSAIEventInterface
    | EntrySAIEventInterface;
