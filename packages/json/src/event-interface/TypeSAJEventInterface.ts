/**
 * Base interface for typed SAJ events carrying a JSON value type discriminator.
 */
export interface TypeSAJEventInterface<ValueType extends "number" | "string" | "null" | "array" | "object" | "boolean"> {
  type: ValueType
}
