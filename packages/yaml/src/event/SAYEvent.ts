import { SAEvent } from "@simple-api-stream/core";
import type { SAYEventInterface } from "../event-interface/index.js";

/**
 * Base class for SAY (Simple API for YAML) event objects.
 */
export class SAYEvent<T extends SAYEventInterface["name"]> extends SAEvent<T> {}
