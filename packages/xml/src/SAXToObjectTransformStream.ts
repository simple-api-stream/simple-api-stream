import type { SAXEventInterface } from "./event-interface/index.js";
import type {
  XMLChildNode,
  XMLDoctypeNode,
  XMLDocumentNode,
  XMLElementNode,
  XMLProcessingInstructionNode,
} from "./node.js";
import { toErrorMessage } from "./utils/index.js";

const skip = Symbol.for("SAXToObjectTransformStream.skip");

/**
 * Context passed to the `mapDocument` callback of `SAXToObjectTransformStream`.
 */
export type SAXToObjectDocumentContext = {
  /** Return this symbol from `mapDocument` to skip emitting the current document. */
  skip: typeof skip
};

/**
 * Callback that maps a reconstructed `XMLDocumentNode` into a custom JavaScript value.
 */
export type SAXToObjectDocumentMapper<T> = (
  document: XMLDocumentNode,
  context: SAXToObjectDocumentContext,
) => T | typeof skip;

/**
 * Configuration options for `SAXToObjectTransformStream`.
 */
export type SAXToObjectTransformStreamOptions<T> = {
  /** Custom mapper invoked for each completed document. */
  mapDocument?: SAXToObjectDocumentMapper<T>
  /** When `true`, whitespace-only `text` events are omitted from the tree (default: `false`). */
  ignoreWhitespaceText?: boolean
  /** When `true`, `comment` events are omitted from the tree (default: `false`). */
  ignoreComments?: boolean
};

type Status = {
  get inDocument(): boolean
  get openTags(): string[]
};

/**
 * Error thrown by `SAXToObjectTransformStream` when an invalid SAX event sequence or mapper error is encountered.
 */
export class SAXToObjectTransformStreamError extends Error implements Status {
  inDocument: boolean;
  openTags: string[];

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAXToObjectTransformStreamError";
    ({
      inDocument: this.inDocument,
      openTags: this.openTags,
    } = status);
  }
}

function copyAttrs(attrs?: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  if (!attrs) return result;
  for (const [key, value] of Object.entries(attrs)) {
    Reflect.defineProperty(result, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return result;
}

/**
 * A `TransformStream` that reconstructs lightweight plain-object XML AST trees (`XMLDocumentNode`) from SAX events.
 */
export class SAXToObjectTransformStream<T = XMLDocumentNode> extends TransformStream<SAXEventInterface, T> {
  static readonly skip = skip;

  #mapDocument: SAXToObjectDocumentMapper<T> | undefined;
  #ignoreWhitespaceText: boolean;
  #ignoreComments: boolean;
  #inDocument = false;
  #rootChildren: XMLChildNode[] = [];
  #stack: XMLElementNode[] = [];
  #controller!: TransformStreamDefaultController<T>;

  constructor(options?: SAXToObjectTransformStreamOptions<T>) {
    let controller_!: TransformStreamDefaultController<T>;
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
    this.#mapDocument = options?.mapDocument;
    this.#ignoreWhitespaceText = options?.ignoreWhitespaceText ?? false;
    this.#ignoreComments = options?.ignoreComments ?? false;
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      inDocument: this.#inDocument,
      openTags: this.#stack.map(el => el.tagName),
    };
  }

  /**
   * Returns the current reconstructor status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SAXToObjectTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SAXToObjectTransformStreamError(message as string, this.#status(), options);
  }

  #appendChild(node: XMLChildNode): void {
    const parent = this.#stack.at(-1);
    if (parent) {
      parent.children.push(node);
    }
    else {
      this.#rootChildren.push(node);
    }
  }

  #emitDocument(): void {
    const doc: XMLDocumentNode = {
      type: "document",
      children: this.#rootChildren,
    };
    this.#rootChildren = [];

    if (!this.#mapDocument) {
      this.#controller.enqueue(doc as T);
      return;
    }

    let mapped: T | typeof skip;
    try {
      mapped = this.#mapDocument(doc, { skip });
    }
    catch (e: unknown) {
      throw this.#makeError(e);
    }
    if (mapped !== skip) {
      this.#controller.enqueue(mapped);
    }
  }

  #transform(event: SAXEventInterface): void {
    try {
      switch (event.name) {
        case "startDocument": {
          if (this.#inDocument) {
            throw this.#makeError("Unexpected startDocument inside an open document");
          }
          if (this.#stack.length > 0) {
            throw this.#makeError("Unexpected startDocument inside an open element");
          }
          this.#inDocument = true;
          this.#rootChildren = [];
          break;
        }
        case "endDocument": {
          if (!this.#inDocument) {
            throw this.#makeError("Unexpected endDocument without matching startDocument");
          }
          if (this.#stack.length > 0) {
            throw this.#makeError("Unexpected endDocument while elements are still open");
          }
          this.#inDocument = false;
          this.#emitDocument();
          break;
        }
        case "startElement": {
          const element: XMLElementNode = {
            type: "element",
            tagName: event.tagName,
            attrs: copyAttrs(event.attrs),
            children: [],
          };
          if (event.selfClosing) {
            element.selfClosing = true;
          }
          this.#appendChild(element);
          this.#stack.push(element);
          break;
        }
        case "endElement": {
          const top = this.#stack.at(-1);
          if (!top) {
            throw this.#makeError(`Unexpected endElement </${event.tagName}> without matching startElement`);
          }
          if (top.tagName !== event.tagName) {
            throw this.#makeError(`Mismatched endElement </${event.tagName}> for open <${top.tagName}>`);
          }
          this.#stack.pop();
          break;
        }
        case "text": {
          if (this.#ignoreWhitespaceText && event.text.trim().length === 0) {
            break;
          }
          this.#appendChild({ type: "text", text: event.text });
          break;
        }
        case "cdata": {
          this.#appendChild({ type: "cdata", cdata: event.cdata });
          break;
        }
        case "comment": {
          if (this.#ignoreComments) {
            break;
          }
          this.#appendChild({ type: "comment", comment: event.comment });
          break;
        }
        case "processingInstruction": {
          const node: XMLProcessingInstructionNode = {
            type: "processingInstruction",
            target: event.target,
            data: event.data,
          };
          if ("version" in event) {
            node.version = event.version;
            node.encoding = event.encoding;
            node.standalone = event.standalone;
          }
          else if ("href" in event) {
            node.contentType = event.type;
            node.href = event.href;
          }
          this.#appendChild(node);
          break;
        }
        case "doctype": {
          let node: XMLDoctypeNode;
          if (event.dtdType === "PUBLIC") {
            node = {
              type: "doctype",
              root: event.root,
              dtdType: "PUBLIC",
              identifier: event.identifier,
              ...(event.uri !== undefined ? { uri: event.uri } : {}),
              ...(event.declarations ? { declarations: [...event.declarations] } : {}),
            };
          }
          else if (event.dtdType === "SYSTEM") {
            node = {
              type: "doctype",
              root: event.root,
              dtdType: "SYSTEM",
              uri: event.uri,
              ...(event.declarations ? { declarations: [...event.declarations] } : {}),
            };
          }
          else {
            node = {
              type: "doctype",
              root: event.root,
              ...(event.declarations ? { declarations: [...event.declarations] } : {}),
            };
          }
          this.#appendChild(node);
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
      if (this.#stack.length > 0) {
        throw this.#makeError(`Stream ended with unclosed element <${this.#stack.at(-1)!.tagName}>`);
      }
      if (this.#inDocument) {
        throw this.#makeError("Stream ended with unclosed document");
      }
      if (this.#rootChildren.length > 0) {
        this.#emitDocument();
      }
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }
}
