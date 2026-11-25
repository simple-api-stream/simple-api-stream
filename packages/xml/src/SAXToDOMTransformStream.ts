import type { SAXEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

/**
 * Minimal structural interface for a mutable DOM node that supports `appendChild`.
 */
export interface DOMMutableNodeLike {
  appendChild(node: DOMMutableNodeLike): unknown
}

/**
 * Minimal structural interface for a mutable DOM element that supports `setAttribute`.
 */
export interface DOMMutableElementLike extends DOMMutableNodeLike {
  setAttribute(name: string, value: string): void
}

/**
 * Minimal structural interface for a DOM `DOMImplementation` capable of creating XML documents and doctypes.
 */
export interface DOMDocumentImplementationLike<TDocument extends DOMMutableNodeLike = DOMMutableNodeLike> {
  createDocument(namespaceURI: string | null, qualifiedName: string | null, doctype?: DOMMutableNodeLike | null): TDocument
  createDocumentType?(qualifiedName: string, publicId: string, systemId: string): DOMMutableNodeLike
}

/**
 * Minimal structural interface for a DOM `Document` factory (compatible with browser `document`, `jsdom`, `happy-dom`, `linkedom`, and `@xmldom/xmldom`).
 */
export interface DOMDocumentFactoryLike<TDocument extends DOMMutableNodeLike = DOMMutableNodeLike> {
  createElement(tagName: string): DOMMutableElementLike
  createTextNode(data: string): DOMMutableNodeLike
  createComment?(data: string): DOMMutableNodeLike
  createCDATASection?(data: string): DOMMutableNodeLike
  createProcessingInstruction?(target: string, data: string): DOMMutableNodeLike
  createDocumentFragment(): DOMMutableNodeLike
  readonly implementation?: DOMDocumentImplementationLike<TDocument> | null
}

/**
 * Configuration options for `SAXToDOMTransformStream`.
 */
export type SAXToDOMTransformStreamOptions<TDocument extends DOMMutableNodeLike = DOMMutableNodeLike> = {
  /**
   * DOM `Document` factory used to create nodes.
   * Defaults to `globalThis.document` when available.
   */
  document?: DOMDocumentFactoryLike<TDocument>
  /**
   * When `true` (default), creates a new XML `Document` per SAX document via `document.implementation.createDocument(null, null)` when available;
   * otherwise builds into a `DocumentFragment`.
   */
  createDocument?: boolean
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
 * Error thrown by `SAXToDOMTransformStream` when no DOM factory is available or an invalid SAX event sequence is encountered.
 */
export class SAXToDOMTransformStreamError extends Error implements Status {
  inDocument: boolean;
  openTags: string[];

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAXToDOMTransformStreamError";
    ({
      inDocument: this.inDocument,
      openTags: this.openTags,
    } = status);
  }
}

function resolveDefaultDocument<TDocument extends DOMMutableNodeLike>(): DOMDocumentFactoryLike<TDocument> | undefined {
  return (globalThis as unknown as { document?: DOMDocumentFactoryLike<TDocument> }).document;
}

function isDocumentFactory(value: unknown): value is DOMDocumentFactoryLike {
  return (
    typeof value === "object"
    && value !== null
    && typeof (value as { createElement?: unknown }).createElement === "function"
    && typeof (value as { createTextNode?: unknown }).createTextNode === "function"
  );
}

/**
 * A `TransformStream` that constructs DOM `Document` or `DocumentFragment` trees from a stream of SAX events.
 * Requires a DOM `Document` factory (`options.document` or `globalThis.document`) with zero runtime dependencies.
 */
export class SAXToDOMTransformStream<TDocument extends DOMMutableNodeLike = DOMMutableNodeLike> extends TransformStream<SAXEventInterface, TDocument> {
  #factory: DOMDocumentFactoryLike<TDocument>;
  #createDocument: boolean;
  #ignoreWhitespaceText: boolean;
  #ignoreComments: boolean;
  #inDocument = false;
  #currentRoot: TDocument | null = null;
  #currentNodeFactory: DOMDocumentFactoryLike = null as unknown as DOMDocumentFactoryLike;
  #stack: { tagName: string, element: DOMMutableElementLike }[] = [];
  #controller!: TransformStreamDefaultController<TDocument>;

  constructor(options?: SAXToDOMTransformStreamOptions<TDocument>) {
    let controller_!: TransformStreamDefaultController<TDocument>;
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
    this.#controller = controller_;
    this.#createDocument = options?.createDocument ?? true;
    this.#ignoreWhitespaceText = options?.ignoreWhitespaceText ?? false;
    this.#ignoreComments = options?.ignoreComments ?? false;

    const factory = options?.document ?? resolveDefaultDocument<TDocument>();
    if (!factory) {
      throw this.#makeError("No DOM document factory available; pass options.document");
    }
    this.#factory = factory;
  }

  #status(): Status {
    return {
      inDocument: this.#inDocument,
      openTags: this.#stack.map(entry => entry.tagName),
    };
  }

  /**
   * Returns the current reconstructor status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SAXToDOMTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SAXToDOMTransformStreamError(message as string, this.#status(), options);
  }

  #ensureRoot(): TDocument {
    if (this.#currentRoot !== null) {
      return this.#currentRoot;
    }
    if (this.#createDocument && this.#factory.implementation) {
      const doc = this.#factory.implementation.createDocument(null, null);
      this.#currentRoot = doc;
      this.#currentNodeFactory = isDocumentFactory(doc) ? doc : this.#factory;
      return doc;
    }
    const fragment = this.#factory.createDocumentFragment() as TDocument;
    this.#currentRoot = fragment;
    this.#currentNodeFactory = this.#factory;
    return fragment;
  }

  #appendNode(node: DOMMutableNodeLike): void {
    const parent = this.#stack.at(-1)?.element ?? this.#ensureRoot();
    parent.appendChild(node);
  }

  #emitRoot(): void {
    const root = this.#ensureRoot();
    this.#currentRoot = null;
    this.#controller.enqueue(root);
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
          this.#currentRoot = null;
          this.#ensureRoot();
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
          this.#emitRoot();
          break;
        }
        case "startElement": {
          this.#ensureRoot();
          const element = this.#currentNodeFactory.createElement(event.tagName);
          if (event.attrs) {
            for (const [key, value] of Object.entries(event.attrs)) {
              element.setAttribute(key, value);
            }
          }
          this.#appendNode(element);
          this.#stack.push({ tagName: event.tagName, element });
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
          this.#ensureRoot();
          this.#appendNode(this.#currentNodeFactory.createTextNode(event.text));
          break;
        }
        case "cdata": {
          this.#ensureRoot();
          const node = this.#currentNodeFactory.createCDATASection
            ? this.#currentNodeFactory.createCDATASection(event.cdata)
            : this.#currentNodeFactory.createTextNode(event.cdata);
          this.#appendNode(node);
          break;
        }
        case "comment": {
          if (this.#ignoreComments) {
            break;
          }
          this.#ensureRoot();
          if (this.#currentNodeFactory.createComment) {
            this.#appendNode(this.#currentNodeFactory.createComment(event.comment));
          }
          break;
        }
        case "processingInstruction": {
          this.#ensureRoot();
          if (this.#currentNodeFactory.createProcessingInstruction) {
            this.#appendNode(this.#currentNodeFactory.createProcessingInstruction(event.target, event.data));
          }
          break;
        }
        case "doctype": {
          this.#ensureRoot();
          if (this.#factory.implementation?.createDocumentType) {
            const publicId = event.dtdType === "PUBLIC" ? event.identifier : "";
            const systemId = event.dtdType === "PUBLIC"
              ? (event.uri ?? "")
              : event.dtdType === "SYSTEM"
                ? event.uri
                : "";
            this.#appendNode(this.#factory.implementation.createDocumentType(event.root, publicId, systemId));
          }
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
      if (this.#currentRoot !== null) {
        this.#emitRoot();
      }
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }
}
