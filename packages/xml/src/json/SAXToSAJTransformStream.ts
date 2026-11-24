import type { eventInterfaces } from "@simple-api-stream/json";
import type { SAXEventInterface } from "../event-interface/index.js";
import { toErrorMessage } from "../utils/index.js";

type SAJEventInterface = eventInterfaces.SAJEventInterface;

/**
 * Configuration options for `SAXToSAJTransformStream`.
 */
export type SAXToSAJTransformStreamOptions = {
  /** Wrap each emitted JSON document in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /** When `true`, whitespace-only `text` events are omitted (default: `false`). */
  ignoreWhitespaceText?: boolean
  /** When `true`, `comment` events are omitted (default: `false`). */
  ignoreComments?: boolean
};

type Status = {
  get inDocument(): boolean
  get openTags(): string[]
};

/**
 * Error thrown by `SAXToSAJTransformStream` when an invalid SAX event sequence is encountered.
 */
export class SAXToSAJTransformStreamError extends Error implements Status {
  inDocument: boolean;
  openTags: string[];

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAXToSAJTransformStreamError";
    ({
      inDocument: this.inDocument,
      openTags: this.openTags,
    } = status);
  }
}

/**
 * A `TransformStream` that streams SAX (Simple API for XML) events directly into SAJ (Simple API for JSON) events
 * using the lossless `XMLDocumentNode` AST structure in O(depth) memory.
 */
export class SAXToSAJTransformStream extends TransformStream<SAXEventInterface, SAJEventInterface> {
  #makeDocument: boolean;
  #ignoreWhitespaceText: boolean;
  #ignoreComments: boolean;
  #inDocument = false;
  #documentOpened = false;
  #openTags: string[] = [];
  #controller!: TransformStreamDefaultController<SAJEventInterface>;

  constructor(options?: SAXToSAJTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<SAJEventInterface>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#transform(chunk);
      },
      flush: () => {
        this.#flush();
      },
    });
    this.#makeDocument = options?.makeDocument ?? true;
    this.#ignoreWhitespaceText = options?.ignoreWhitespaceText ?? false;
    this.#ignoreComments = options?.ignoreComments ?? false;
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      inDocument: this.#inDocument,
      openTags: [...this.#openTags],
    };
  }

  /**
   * Returns the current converter status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SAXToSAJTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SAXToSAJTransformStreamError(message as string, this.#status(), options);
  }

  #emit(event: SAJEventInterface): void {
    this.#controller.enqueue(event);
  }

  #emitStringProp(key: string, value: string): void {
    this.#emit({ name: "key", key });
    this.#emit({ name: "value", type: "string", value });
  }

  #ensureDocumentOpened(): void {
    if (this.#documentOpened) return;
    this.#documentOpened = true;
    if (this.#makeDocument) {
      this.#emit({ name: "startDocument", kind: "json" });
    }
    this.#emit({ name: "startObject" });
    this.#emitStringProp("type", "document");
    this.#emit({ name: "key", key: "children" });
    this.#emit({ name: "startArray" });
  }

  #closeDocument(): void {
    this.#emit({ name: "endArray" });
    this.#emit({ name: "endObject" });
    if (this.#makeDocument) {
      this.#emit({ name: "endDocument" });
    }
    this.#documentOpened = false;
  }

  #transform(event: SAXEventInterface): void {
    try {
      switch (event.name) {
        case "startDocument": {
          if (this.#inDocument) {
            throw this.#makeError("Unexpected startDocument inside an open document");
          }
          if (this.#openTags.length > 0) {
            throw this.#makeError("Unexpected startDocument inside an open element");
          }
          this.#inDocument = true;
          this.#ensureDocumentOpened();
          break;
        }
        case "endDocument": {
          if (!this.#inDocument) {
            throw this.#makeError("Unexpected endDocument without matching startDocument");
          }
          if (this.#openTags.length > 0) {
            throw this.#makeError("Unexpected endDocument while elements are still open");
          }
          this.#inDocument = false;
          this.#closeDocument();
          break;
        }
        case "startElement": {
          this.#ensureDocumentOpened();
          this.#emit({ name: "startObject" });
          this.#emitStringProp("type", "element");
          this.#emitStringProp("tagName", event.tagName);
          this.#emit({ name: "key", key: "attrs" });
          this.#emit({ name: "startObject" });
          if (event.attrs) {
            for (const [k, v] of Object.entries(event.attrs)) {
              this.#emitStringProp(k, v);
            }
          }
          this.#emit({ name: "endObject" });
          if (event.selfClosing) {
            this.#emit({ name: "key", key: "selfClosing" });
            this.#emit({ name: "value", type: "boolean", value: true });
          }
          this.#emit({ name: "key", key: "children" });
          this.#emit({ name: "startArray" });
          this.#openTags.push(event.tagName);
          break;
        }
        case "endElement": {
          const top = this.#openTags.at(-1);
          if (top === undefined) {
            throw this.#makeError(`Unexpected endElement </${event.tagName}> without matching startElement`);
          }
          if (top !== event.tagName) {
            throw this.#makeError(`Mismatched endElement </${event.tagName}> for open <${top}>`);
          }
          this.#openTags.pop();
          this.#emit({ name: "endArray" });
          this.#emit({ name: "endObject" });
          break;
        }
        case "text": {
          if (this.#ignoreWhitespaceText && event.text.trim().length === 0) {
            break;
          }
          this.#ensureDocumentOpened();
          this.#emit({ name: "startObject" });
          this.#emitStringProp("type", "text");
          this.#emitStringProp("text", event.text);
          this.#emit({ name: "endObject" });
          break;
        }
        case "cdata": {
          this.#ensureDocumentOpened();
          this.#emit({ name: "startObject" });
          this.#emitStringProp("type", "cdata");
          this.#emitStringProp("cdata", event.cdata);
          this.#emit({ name: "endObject" });
          break;
        }
        case "comment": {
          if (this.#ignoreComments) {
            break;
          }
          this.#ensureDocumentOpened();
          this.#emit({ name: "startObject" });
          this.#emitStringProp("type", "comment");
          this.#emitStringProp("comment", event.comment);
          this.#emit({ name: "endObject" });
          break;
        }
        case "processingInstruction": {
          this.#ensureDocumentOpened();
          this.#emit({ name: "startObject" });
          this.#emitStringProp("type", "processingInstruction");
          this.#emitStringProp("target", event.target);
          this.#emitStringProp("data", event.data);
          if ("version" in event) {
            this.#emitStringProp("version", event.version);
            this.#emitStringProp("encoding", event.encoding);
            this.#emitStringProp("standalone", event.standalone);
          }
          else if ("href" in event) {
            this.#emitStringProp("contentType", event.type);
            this.#emitStringProp("href", event.href);
          }
          this.#emit({ name: "endObject" });
          break;
        }
        case "doctype": {
          this.#ensureDocumentOpened();
          this.#emit({ name: "startObject" });
          this.#emitStringProp("type", "doctype");
          this.#emitStringProp("root", event.root);
          if (event.dtdType === "PUBLIC") {
            this.#emitStringProp("dtdType", "PUBLIC");
            this.#emitStringProp("identifier", event.identifier);
            if (event.uri !== undefined) {
              this.#emitStringProp("uri", event.uri);
            }
          }
          else if (event.dtdType === "SYSTEM") {
            this.#emitStringProp("dtdType", "SYSTEM");
            this.#emitStringProp("uri", event.uri);
          }
          if (event.declarations) {
            this.#emit({ name: "key", key: "declarations" });
            this.#emit({ name: "startArray" });
            for (const decl of event.declarations) {
              this.#emit({ name: "value", type: "string", value: decl });
            }
            this.#emit({ name: "endArray" });
          }
          this.#emit({ name: "endObject" });
          break;
        }
        default: {
          const exhaustive: never = event;
          throw this.#makeError(`Unknown SAX event: ${String((exhaustive as { name?: unknown }).name)}`);
        }
      }
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }

  #flush(): void {
    try {
      if (this.#openTags.length > 0) {
        throw this.#makeError(`Stream ended with unclosed element <${this.#openTags.at(-1)!}>`);
      }
      if (this.#inDocument) {
        throw this.#makeError("Stream ended with unclosed document");
      }
      if (this.#documentOpened) {
        this.#closeDocument();
      }
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }
}
