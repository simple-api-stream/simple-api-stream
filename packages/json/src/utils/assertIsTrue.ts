/**
 * Asserts that `value` is `true`, throwing an `Error` otherwise.
 * @param value Target boolean value to check
 * @param message Optional error message
 */
export function assertIsTrue(value: boolean, message?: string): asserts value is true {
  if (!value) throw new Error(message ?? "assert is false");
}
