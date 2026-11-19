import type { StartArraySAJEventInterface } from "../event-interface/index.js";
import { SAJEvent } from "./SAJEvent.js";

export const SAJ_START_ARRAY_EVENT_TYPE = "startArray";
export class StartArrayEvent extends SAJEvent<typeof SAJ_START_ARRAY_EVENT_TYPE> implements StartArraySAJEventInterface {
  constructor() {
    super(SAJ_START_ARRAY_EVENT_TYPE);
  }
}
