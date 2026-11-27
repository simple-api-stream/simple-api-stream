/**
 * Interface for an INI key-value entry event (`key = value`).
 */
export interface EntrySAIEventInterface {
  name: "entry"
  key: string
  value: string
}
