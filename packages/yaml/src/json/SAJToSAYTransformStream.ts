import type { eventInterfaces } from "@simple-api-stream/json";
import {
  CommentEvent,
  EndDocumentEvent,
  EndMappingEvent,
  EndSequenceEvent,
  KeyEvent,
  ScalarEvent,
  StartDocumentEvent,
  StartMappingEvent,
  StartSequenceEvent,
} from "../event/index.js";
import type { SAYEventInterface } from "../event-interface/index.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

/**
 * Configuration options for `SAJToSAYTransformStream`.
 */
export type SAJToSAYTransformStreamOptions = {
  /** Convert `startDocument` / `endDocument` events (default: `true`). */
  makeDocument?: boolean
  /** Forward JSONC `comment` events as YAML `comment` events (default: `true`). */
  comments?: boolean
};

/**
 * A `TransformStream` that streams SAJ (Simple API for JSON) events directly into SAY (Simple API for YAML) events without buffering.
 */
export class SAJToSAYTransformStream extends TransformStream<SAJEventInterface, SAYEventInterface> {
  constructor(options?: SAJToSAYTransformStreamOptions) {
    const makeDocument = options?.makeDocument ?? true;
    const comments = options?.comments ?? true;

    super({
      transform: (event, controller) => {
        switch (event.name) {
          case "startDocument":
            if (makeDocument) {
              controller.enqueue(new StartDocumentEvent());
            }
            break;
          case "endDocument":
            if (makeDocument) {
              controller.enqueue(new EndDocumentEvent());
            }
            break;
          case "comment":
            if (comments) {
              controller.enqueue(new CommentEvent(event.comment));
            }
            break;
          case "startObject":
            controller.enqueue(new StartMappingEvent());
            break;
          case "endObject":
            controller.enqueue(new EndMappingEvent());
            break;
          case "startArray":
            controller.enqueue(new StartSequenceEvent());
            break;
          case "endArray":
            controller.enqueue(new EndSequenceEvent());
            break;
          case "key":
            controller.enqueue(new KeyEvent(event.key));
            break;
          case "value":
            switch (event.type) {
              case "null":
                controller.enqueue(new ScalarEvent("null", null).toInterface());
                break;
              case "boolean":
                controller.enqueue(new ScalarEvent("boolean", event.value).toInterface());
                break;
              case "number":
                controller.enqueue(new ScalarEvent("number", event.value).toInterface());
                break;
              case "string":
                controller.enqueue(new ScalarEvent("string", event.value).toInterface());
                break;
            }
            break;
          case "error":
            controller.error(event.error);
            break;
        }
      },
    });
  }
}
