import type { StartDocumentSACEventInterface } from "./StartDocumentSACEventInterface.js";
import type { EndDocumentSACEventInterface } from "./EndDocumentSACEventInterface.js";
import type { StartHeaderRowSACEventInterface } from "./StartHeaderRowSACEventInterface.js";
import type { EndHeaderRowSACEventInterface } from "./EndHeaderRowSACEventInterface.js";
import type { StartRecordRowSACEventInterface } from "./StartRecordRowSACEventInterface.js";
import type { EndRecordRowSACEventInterface } from "./EndRecordRowSACEventInterface.js";
import type { ColumnSACEventInterface } from "./ColumnSACEventInterface.js";

/**
 * Union type of all SAC (Simple API for CSV) events.
 */
export type SACEventInterface =
  | StartDocumentSACEventInterface
  | EndDocumentSACEventInterface
  | StartHeaderRowSACEventInterface
  | EndHeaderRowSACEventInterface
  | StartRecordRowSACEventInterface
  | EndRecordRowSACEventInterface
  | ColumnSACEventInterface;
