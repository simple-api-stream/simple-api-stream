import { SAEvent } from "@simple-api-stream/core";
import type { SAIEventInterface } from "../event-interface/index.js";

/**
 * Base class for SAI (Simple API for INI) event objects.
 */
export class SAIEvent<T extends SAIEventInterface["name"]> extends SAEvent<T> {}
