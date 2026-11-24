/**
 * Common interface for streaming Simple API parsers.
 */
export interface SimpleApiParser<T> {
  /**
   * Feeds a chunk of input data into the parser.
   */
  enqueue(chunk: T): void
  /**
   * Finalizes parsing of any remaining buffered input.
   */
  flush(): void
}
