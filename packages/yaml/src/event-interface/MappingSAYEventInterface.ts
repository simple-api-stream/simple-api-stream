/**
 * Interface for the start of a YAML mapping (block or flow `{ ... }`).
 */
export interface StartMappingSAYEventInterface {
  name: "startMapping"
  flow?: boolean
  anchor?: string
  tag?: string
}

/**
 * Interface for the end of a YAML mapping.
 */
export interface EndMappingSAYEventInterface {
  name: "endMapping"
}
