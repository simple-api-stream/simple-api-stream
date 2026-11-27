import type { eventInterfaces } from "@simple-api-stream/toml";
import type { SAIEventInterface } from "../event-interface/index.js";

type SATEventInterface = eventInterfaces.SATEventInterface;

/**
 * Configuration options for `SAIToSATTransformStream`.
 */
export type SAIToSATTransformStreamOptions = {
  /** Convert `startDocument` / `endDocument` events (default: `true`). */
  makeDocument?: boolean
  /** Forward `comment` events to SAT `comment` events (default: `true`). */
  comments?: boolean
  /** Split dot-separated INI section names (e.g. `[a.b]`) into TOML table paths (`["a", "b"]`) (default: `false`). */
  splitDots?: boolean
};

/**
 * A `TransformStream` that streams SAI (Simple API for INI) events directly into SAT (Simple API for TOML) events without full-document buffering.
 */
export class SAIToSATTransformStream extends TransformStream<SAIEventInterface, SATEventInterface> {
  constructor(options?: SAIToSATTransformStreamOptions) {
    const makeDocument = options?.makeDocument ?? true;
    const comments = options?.comments ?? true;
    const splitDots = options?.splitDots ?? false;

    super({
      transform: (event, controller) => {
        switch (event.name) {
          case "startDocument":
            if (makeDocument) {
              controller.enqueue({ name: "startDocument", kind: "toml" });
            }
            break;
          case "endDocument":
            if (makeDocument) {
              controller.enqueue({ name: "endDocument" });
            }
            break;
          case "comment":
            if (comments) {
              controller.enqueue({ name: "comment", comment: event.comment });
            }
            break;
          case "section": {
            const path = splitDots ? event.section.split(".") : [event.section];
            controller.enqueue({ name: "table", path });
            break;
          }
          case "entry":
            controller.enqueue({ name: "key", path: [event.key] });
            controller.enqueue({ name: "value", type: "string", value: event.value });
            break;
        }
      },
    });
  }
}
