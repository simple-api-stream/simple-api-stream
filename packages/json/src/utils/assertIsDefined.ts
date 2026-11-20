/**
 * Asserts that `value` is neither `null` nor `undefined`, throwing an `Error` otherwise.
 * @param value Target value to check
 * @param message Optional error message
 */
export function assertIsDefined<T>(value: T, message?: string): asserts value is NonNullable<T> {
  if (value === undefined || value === null)
    throw new Error(message ?? "Value is undefined");
}
