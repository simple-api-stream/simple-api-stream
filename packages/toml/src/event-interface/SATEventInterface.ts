import type { ArrayTableSATEventInterface } from "./ArrayTableSATEventInterface.js";
import type { CommentSATEventInterface } from "./CommentSATEventInterface.js";
import type { EndArraySATEventInterface } from "./EndArraySATEventInterface.js";
import type { EndDocumentSATEventInterface } from "./EndDocumentSATEventInterface.js";
import type { EndInlineTableSATEventInterface } from "./EndInlineTableSATEventInterface.js";
import type { KeySATEventInterface } from "./KeySATEventInterface.js";
import type { StartArraySATEventInterface } from "./StartArraySATEventInterface.js";
import type { StartDocumentSATEventInterface } from "./StartDocumentSATEventInterface.js";
import type { StartInlineTableSATEventInterface } from "./StartInlineTableSATEventInterface.js";
import type { TableSATEventInterface } from "./TableSATEventInterface.js";
import type { ValueSATEventInterface } from "./ValueSATEventInterface.js";

/**
 * Union type of all SAT (Simple API for TOML) event interfaces.
 */
export type SATEventInterface
  = StartDocumentSATEventInterface
    | EndDocumentSATEventInterface
    | CommentSATEventInterface
    | TableSATEventInterface
    | ArrayTableSATEventInterface
    | KeySATEventInterface
    | StartInlineTableSATEventInterface
    | EndInlineTableSATEventInterface
    | StartArraySATEventInterface
    | EndArraySATEventInterface
    | ValueSATEventInterface;
