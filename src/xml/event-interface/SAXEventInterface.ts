import type { EndElementSAXEventInterface } from "./EndElementSAXEventInterface.js";
import type { StartElementSAXEventInterface } from "./StartElementSAXEventInterface.js";
import type { TextSAXEventInterface } from "./TextSAXEventInterface.js";
import type { DoctypeSAXEventInterface } from "./DoctypeSAXEventInterface.js";
import type { CommentSAXEventInterface } from "./CommentSAXEventInterface.js";
import type { CdataSAXEventInterface } from "./CdataSAXEventInterface.js";
import type { XMLdeclarationSAXEventInterface } from "./XMLdeclarationSAXEventInterface.js";
import type { XMLStylesheetDeclarationSAXEventInterface } from "./XMLStylesheetDeclarationSAXEventInterface.js";
import type { ProcessingInstructionSAXEventInterface } from "./ProcessingInstructionSAXEventInterface.js";
import type { StartDocumentSAXEventInterface } from "./StartDocumentSAXEventInterface.js";
import type { EndDocumentSAXEventInterface } from "./EndDocumentSAXEventInterface.js";

export type SAXEventInterface
  = DoctypeSAXEventInterface
    | StartElementSAXEventInterface
    | EndElementSAXEventInterface
    | TextSAXEventInterface
    | CommentSAXEventInterface
    | CdataSAXEventInterface
    | XMLdeclarationSAXEventInterface
    | XMLStylesheetDeclarationSAXEventInterface
    | ProcessingInstructionSAXEventInterface
    | StartDocumentSAXEventInterface
    | EndDocumentSAXEventInterface;
