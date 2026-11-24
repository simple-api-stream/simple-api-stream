import { SAEvent } from "@simple-api-stream/core";
import type { SATEventInterface } from "../event-interface/index.js";

/**
 * Base class for SAT (Simple API for TOML) event objects.
 */
export class SATEvent<T extends SATEventInterface["name"]> extends SAEvent<T> {}
