/**
 * Interface for an INI section header event (`[section]`).
 */
export interface SectionSAIEventInterface {
  name: "section"
  section: string
}
