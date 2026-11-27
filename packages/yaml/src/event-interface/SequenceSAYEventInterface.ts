/**
 * Interface for the start of a YAML sequence (block or flow `[ ... ]`).
 */
export interface StartSequenceSAYEventInterface {
  name: "startSequence"
  flow?: boolean
  anchor?: string
  tag?: string
}

/**
 * Interface for the end of a YAML sequence.
 */
export interface EndSequenceSAYEventInterface {
  name: "endSequence"
}
