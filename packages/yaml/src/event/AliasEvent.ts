import type { AliasSAYEventInterface } from "../event-interface/index.js";
import { SAYEvent } from "./SAYEvent.js";

export const SAY_ALIAS_EVENT_TYPE = "alias";

/**
 * Event class representing a YAML alias (`*anchor`).
 */
export class AliasEvent extends SAYEvent<typeof SAY_ALIAS_EVENT_TYPE> implements AliasSAYEventInterface {
  alias: string;
  constructor(alias: string) {
    super(SAY_ALIAS_EVENT_TYPE);
    this.alias = alias;
  }
}
