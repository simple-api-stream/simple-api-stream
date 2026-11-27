import type { AliasSAYEventInterface } from "./AliasSAYEventInterface.js";
import type { CommentSAYEventInterface } from "./CommentSAYEventInterface.js";
import type { EndDocumentSAYEventInterface } from "./EndDocumentSAYEventInterface.js";
import type { KeySAYEventInterface } from "./KeySAYEventInterface.js";
import type { EndMappingSAYEventInterface, StartMappingSAYEventInterface } from "./MappingSAYEventInterface.js";
import type { ScalarSAYEventInterface } from "./ScalarSAYEventInterface.js";
import type { EndSequenceSAYEventInterface, StartSequenceSAYEventInterface } from "./SequenceSAYEventInterface.js";
import type { StartDocumentSAYEventInterface } from "./StartDocumentSAYEventInterface.js";

/**
 * Union type of all SAY (Simple API for YAML) event interfaces.
 */
export type SAYEventInterface
  = StartDocumentSAYEventInterface
    | EndDocumentSAYEventInterface
    | CommentSAYEventInterface
    | StartMappingSAYEventInterface
    | EndMappingSAYEventInterface
    | StartSequenceSAYEventInterface
    | EndSequenceSAYEventInterface
    | KeySAYEventInterface
    | ScalarSAYEventInterface
    | AliasSAYEventInterface;
