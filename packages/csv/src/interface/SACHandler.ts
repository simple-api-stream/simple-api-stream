import type {
  ColumnSACEventInterface,
  EndDocumentSACEventInterface,
  EndHeaderRowSACEventInterface,
  EndRecordRowSACEventInterface,
  StartDocumentSACEventInterface,
  StartHeaderRowSACEventInterface,
  StartRecordRowSACEventInterface,
} from "../event-interface/index.js";

/**
 * Callback interface for consuming SAC (Simple API for CSV) events.
 */
export interface SACHandler {
  onStartDocument: (arg: StartDocumentSACEventInterface) => void
  onEndDocument: (arg: EndDocumentSACEventInterface) => void
  onStartHeaderRow: (arg: StartHeaderRowSACEventInterface) => void
  onEndHeaderRow: (arg: EndHeaderRowSACEventInterface) => void
  onStartRecordRow: (arg: StartRecordRowSACEventInterface) => void
  onEndRecordRow: (arg: EndRecordRowSACEventInterface) => void
  onColumn: (arg: ColumnSACEventInterface) => void
  onError: (err: unknown) => void
}
