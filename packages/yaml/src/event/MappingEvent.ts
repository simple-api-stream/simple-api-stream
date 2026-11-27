import type { EndMappingSAYEventInterface, StartMappingSAYEventInterface } from "../event-interface/index.js";
import { SAYEvent } from "./SAYEvent.js";

export const SAY_START_MAPPING_EVENT_TYPE = "startMapping";
export const SAY_END_MAPPING_EVENT_TYPE = "endMapping";

export type CollectionEventOptions = {
  flow?: boolean
  anchor?: string
  tag?: string
};

/**
 * Event class representing the start of a YAML mapping.
 */
export class StartMappingEvent extends SAYEvent<typeof SAY_START_MAPPING_EVENT_TYPE> implements StartMappingSAYEventInterface {
  declare flow?: boolean;
  declare anchor?: string;
  declare tag?: string;
  constructor(options?: CollectionEventOptions) {
    super(SAY_START_MAPPING_EVENT_TYPE);
    if (options?.flow !== undefined) this.flow = options.flow;
    if (options?.anchor !== undefined) this.anchor = options.anchor;
    if (options?.tag !== undefined) this.tag = options.tag;
  }
}

/**
 * Event class representing the end of a YAML mapping.
 */
export class EndMappingEvent extends SAYEvent<typeof SAY_END_MAPPING_EVENT_TYPE> implements EndMappingSAYEventInterface {
  constructor() {
    super(SAY_END_MAPPING_EVENT_TYPE);
  }
}
