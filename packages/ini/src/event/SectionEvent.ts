import type { SectionSAIEventInterface } from "../event-interface/index.js";
import { SAIEvent } from "./SAIEvent.js";

/**
 * Event name constant for INI section header events.
 */
export const SAI_SECTION_EVENT_TYPE = "section";

/**
 * Event class representing an INI section header (`[section]`).
 */
export class SectionEvent extends SAIEvent<typeof SAI_SECTION_EVENT_TYPE> implements SectionSAIEventInterface {
  section: string;
  constructor(section: string) {
    super(SAI_SECTION_EVENT_TYPE);
    this.section = section;
  }
}
