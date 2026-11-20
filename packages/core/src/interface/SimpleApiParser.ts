/**
 * Common interface for streaming Simple API parsers.
 */
export interface SimpleApiParser<T> {
  enqueue(chunk: T): void
  flush(): void
}
