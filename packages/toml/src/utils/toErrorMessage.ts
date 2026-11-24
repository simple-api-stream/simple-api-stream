/**
 * Normalizes an unknown error or message value into a `{ message, options }` object suitable for `Error` construction.
 * @param message Error instance or message value
 * @param options Optional `ErrorOptions` to extend with `cause` when `message` is not a string
 */
export function toErrorMessage(message: unknown, options?: ErrorOptions): {
  message: string
  options?: ErrorOptions
} {
  let message2: string;
  if (typeof message === "string")
    message2 = message;
  else {
    (options ??= {}).cause ??= message;
    message2 = `${(message as Error | undefined)?.message ?? String(message)}`;
  }
  return { message: message2, options };
}
