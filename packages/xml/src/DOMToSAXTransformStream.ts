import type { SAXEventInterface } from "./event-interface/index.js";
import {
  CdataEvent,
  CommentEvent,
  DoctypePublicEvent,
  DoctypeSimpleEvent,
  DoctypeSystemEvent,
  EndDocumentEvent,
  EndElementEvent,
  ProcessingInstructionEvent,
  StartDocumentEvent,
  StartElementEvent,
  TextEvent,
} from "./event/index.js";
import { toErrorMessage } from "./utils/index.js";

/**
 * Minimal structural interface representing a DOM attribute (`Attr`).
 */
export interface DOMAttrLike {
  readonly name: string
  readonly value: string
}

/**
 * Minimal structural interface representing a DOM node (`Node`, `Element`, `Document`, `DocumentFragment`, etc.).
 * Compatible with browser DOM, `DOMParser`, `jsdom`, `happy-dom`, `linkedom`, and `@xmldom/xmldom` without runtime dependencies.
 */
export interface DOMNodeLike {
  readonly nodeType: number
  readonly nodeName?: string
  readonly tagName?: string
  readonly nodeValue?: string | null
  readonly data?: string
  readonly target?: string
  readonly name?: string
  readonly publicId?: string
  readonly systemId?: string
  readonly attributes?: ArrayLike<DOMAttrLike> | null
  readonly childNodes?: ArrayLike<DOMNodeLike> | null
}

/**
 * Configuration options for `DOMToSAXTransformStream`.
 */
export type DOMToSAXTransformStreamOptions = {
  /** Wrap each top-level DOM node in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /** Mark elements with no child nodes as `selfClosing: true` (default: `false`). */
  selfClosingEmptyElements?: boolean
};

type Status = {
  get makeDocument(): boolean
  get selfClosingEmptyElements(): boolean
};

/**
 * Error thrown by `DOMToSAXTransformStream` when an unsupported DOM node or circular reference is encountered.
 */
export class DOMToSAXTransformStreamError extends Error implements Status {
  makeDocument: boolean;
  selfClosingEmptyElements: boolean;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "DOMToSAXTransformStreamError";
    ({
      makeDocument: this.makeDocument,
      selfClosingEmptyElements: this.selfClosingEmptyElements,
    } = status);
  }
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;
const DOCUMENT_NODE = 9;
const DOCUMENT_TYPE_NODE = 10;
const DOCUMENT_FRAGMENT_NODE = 11;

/**
 * A `TransformStream` that converts DOM-like nodes (`Document`, `Element`, `DocumentFragment`, etc.) into a stream of SAX events.
 */
export class DOMToSAXTransformStream extends TransformStream<DOMNodeLike, SAXEventInterface> {
  #makeDocument: boolean;
  #selfClosingEmptyElements: boolean;
  #controller!: TransformStreamDefaultController<SAXEventInterface>;

  constructor(options?: DOMToSAXTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<SAXEventInterface>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#transform(chunk);
      },
    });
    this.#makeDocument = options?.makeDocument ?? true;
    this.#selfClosingEmptyElements = options?.selfClosingEmptyElements ?? false;
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      makeDocument: this.#makeDocument,
      selfClosingEmptyElements: this.#selfClosingEmptyElements,
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): DOMToSAXTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new DOMToSAXTransformStreamError(message as string, this.#status(), options);
  }

  * #emitChildren(node: DOMNodeLike, ancestors: Set<object>): Generator<SAXEventInterface, void, void> {
    const childNodes = node.childNodes;
    if (!childNodes) return;
    for (let i = 0; i < childNodes.length; i++) {
      yield* this.#emitNode(childNodes[i], ancestors);
    }
  }

  * #emitNode(node: DOMNodeLike, ancestors: Set<object>): Generator<SAXEventInterface, void, void> {
    if (ancestors.has(node)) {
      throw this.#makeError("Circular reference detected");
    }
    ancestors.add(node);
    try {
      switch (node.nodeType) {
        case ELEMENT_NODE: {
          const tagName = node.tagName ?? node.nodeName;
          if (!tagName) {
            throw this.#makeError("DOM Element node is missing tagName");
          }
          const attrs: Record<string, string> = {};
          if (node.attributes) {
            for (let i = 0; i < node.attributes.length; i++) {
              const attr = node.attributes[i];
              Reflect.defineProperty(attrs, attr.name, {
                value: attr.value,
                writable: true,
                enumerable: true,
                configurable: true,
              });
            }
          }
          const hasChildren = (node.childNodes?.length ?? 0) > 0;
          const selfClosing = !hasChildren && this.#selfClosingEmptyElements;
          yield new StartElementEvent(tagName, attrs, selfClosing);
          if (hasChildren) {
            yield* this.#emitChildren(node, ancestors);
          }
          yield new EndElementEvent(tagName);
          return;
        }
        case TEXT_NODE:
          yield new TextEvent(node.data ?? node.nodeValue ?? "");
          return;
        case CDATA_SECTION_NODE:
          yield new CdataEvent(node.data ?? node.nodeValue ?? "");
          return;
        case PROCESSING_INSTRUCTION_NODE: {
          const target = node.target ?? node.nodeName;
          if (!target) {
            throw this.#makeError("DOM ProcessingInstruction node is missing target");
          }
          yield new ProcessingInstructionEvent(target, node.data ?? node.nodeValue ?? "");
          return;
        }
        case COMMENT_NODE:
          yield new CommentEvent(node.data ?? node.nodeValue ?? "");
          return;
        case DOCUMENT_NODE:
        case DOCUMENT_FRAGMENT_NODE:
          yield* this.#emitChildren(node, ancestors);
          return;
        case DOCUMENT_TYPE_NODE: {
          const root = node.name ?? node.nodeName;
          if (!root) {
            throw this.#makeError("DOM DocumentType node is missing name");
          }
          if (node.publicId) {
            yield new DoctypePublicEvent(root, {
              dtdType: "PUBLIC",
              identifier: node.publicId,
              uri: node.systemId || undefined,
            });
            return;
          }
          if (node.systemId) {
            yield new DoctypeSystemEvent(root, {
              dtdType: "SYSTEM",
              uri: node.systemId,
            });
            return;
          }
          yield new DoctypeSimpleEvent(root);
          return;
        }
        default:
          throw this.#makeError(`Unsupported DOM nodeType: ${String(node.nodeType)}`);
      }
    }
    finally {
      ancestors.delete(node);
    }
  }

  #transform(chunk: DOMNodeLike): void {
    try {
      if (typeof chunk !== "object" || chunk === null || typeof chunk.nodeType !== "number") {
        throw this.#makeError("Invalid DOM node");
      }
      const ancestors = new Set<object>();
      if (this.#makeDocument) {
        this.#controller.enqueue(new StartDocumentEvent());
      }
      for (const event of this.#emitNode(chunk, ancestors)) {
        this.#controller.enqueue(event);
      }
      if (this.#makeDocument) {
        this.#controller.enqueue(new EndDocumentEvent());
      }
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }
}
