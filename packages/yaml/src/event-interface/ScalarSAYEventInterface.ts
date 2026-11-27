/**
 * YAML 1.2 Core Schema scalar value type names.
 */
export type ScalarValueType = "string" | "number" | "boolean" | "null";

/**
 * YAML scalar presentation styles.
 */
export type ScalarStyle = "plain" | "single" | "double" | "literal" | "folded";

/**
 * Mapping from `ScalarValueType` to its JavaScript runtime value type.
 */
export type ScalarValueTypeMap = {
  string: string
  number: number
  boolean: boolean
  null: null
};

/**
 * Interface for a YAML scalar value event.
 */
export type ScalarSAYEventInterface<VT extends ScalarValueType = ScalarValueType> = {
  [K in VT]: {
    name: "scalar"
    type: K
    value: ScalarValueTypeMap[K]
    style?: ScalarStyle
    anchor?: string
    tag?: string
  }
}[VT];
