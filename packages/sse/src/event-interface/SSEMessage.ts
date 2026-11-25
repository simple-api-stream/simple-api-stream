/**
 * Plain-object representation of a dispatched Server-Sent Event message.
 */
export interface SSEMessage {
  /** Payload assembled from one or more `data:` lines (joined with `"\n"`). */
  data: string
  /** Event type from the `event:` field, if specified. */
  event?: string
  /** Last event ID from the `id:` field, if specified. */
  id?: string
  /** Reconnection delay in milliseconds from the `retry:` field, if specified. */
  retry?: number
}
