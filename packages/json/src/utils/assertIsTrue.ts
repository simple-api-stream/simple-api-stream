export function assertIsTrue(value: boolean, message?: string): asserts value is true {
  if (!value) throw new Error(message ?? "assert is false");
}
