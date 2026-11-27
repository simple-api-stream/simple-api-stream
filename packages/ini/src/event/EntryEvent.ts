import type { EntrySAIEventInterface } from "../event-interface/index.js";
import { SAIEvent } from "./SAIEvent.js";

/**
 * Event name constant for INI key-value entry events.
 */
export const SAI_ENTRY_EVENT_TYPE = "entry";

/**
 * Event class representing an INI key-value entry (`key = value`).
 */
export class EntryEvent extends SAIEvent<typeof SAI_ENTRY_EVENT_TYPE> implements EntrySAIEventInterface {
  key: string;
  value: string;
  constructor(key: string, value: string) {
    super(SAI_ENTRY_EVENT_TYPE);
    this.key = key;
    this.value = value;
  }
}
