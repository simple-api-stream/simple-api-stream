import type { EndSequenceSAYEventInterface, StartSequenceSAYEventInterface } from "../event-interface/index.js";
import type { CollectionEventOptions } from "./MappingEvent.js";
import { SAYEvent } from "./SAYEvent.js";

export const SAY_START_SEQUENCE_EVENT_TYPE = "startSequence";
export const SAY_END_SEQUENCE_EVENT_TYPE = "endSequence";

/**
 * Event class representing the start of a YAML sequence.
 */
export class StartSequenceEvent extends SAYEvent<typeof SAY_START_SEQUENCE_EVENT_TYPE> implements StartSequenceSAYEventInterface {
  declare flow?: boolean;
  declare anchor?: string;
  declare tag?: string;
  constructor(options?: CollectionEventOptions) {
    super(SAY_START_SEQUENCE_EVENT_TYPE);
    if (options?.flow !== undefined) this.flow = options.flow;
    if (options?.anchor !== undefined) this.anchor = options.anchor;
    if (options?.tag !== undefined) this.tag = options.tag;
  }
}

/**
 * Event class representing the end of a YAML sequence.
 */
export class EndSequenceEvent extends SAYEvent<typeof SAY_END_SEQUENCE_EVENT_TYPE> implements EndSequenceSAYEventInterface {
  constructor() {
    super(SAY_END_SEQUENCE_EVENT_TYPE);
  }
}
