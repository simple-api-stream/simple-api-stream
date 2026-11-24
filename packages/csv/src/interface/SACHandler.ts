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
  /**
   * Invoked when a CSV document starts.
   */
  onStartDocument: (arg: StartDocumentSACEventInterface) => void
  /**
   * Invoked when a CSV document ends.
   */
  onEndDocument: (arg: EndDocumentSACEventInterface) => void
  /**
   * Invoked when a CSV header row starts.
   */
  onStartHeaderRow: (arg: StartHeaderRowSACEventInterface) => void
  /**
   * Invoked when a CSV header row ends.
   */
  onEndHeaderRow: (arg: EndHeaderRowSACEventInterface) => void
  /**
   * Invoked when a CSV record row starts.
   */
  onStartRecordRow: (arg: StartRecordRowSACEventInterface) => void
  /**
   * Invoked when a CSV record row ends.
   */
  onEndRecordRow: (arg: EndRecordRowSACEventInterface) => void
  /**
   * Invoked for each CSV column (cell) value.
   */
  onColumn: (arg: ColumnSACEventInterface) => void
  /**
   * Invoked when an error occurs during parsing or streaming.
   */
  onError: (err: unknown) => void
}
