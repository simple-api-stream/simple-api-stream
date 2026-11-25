import type { SAXEventInterface } from "./event-interface/index.js";
import type { XMLChildNode, XMLNode } from "./node.js";
import {
  CdataEvent,
  CommentEvent,
  DoctypePublicEvent,
  DoctypeSimpleEvent,
  DoctypeSystemEvent,
  EndDocumentEvent,
  EndElementEvent,
  ProcessingInstructionEvent,
  SAX_XML_DECLARATION_STYLESHEET_TARGET_TYPE,
  SAX_XML_DECLARATION_TARGET_TYPE,
  StartDocumentEvent,
  StartElementEvent,
  TextEvent,
  XMLDeclarationEvent,
  XMLStylesheetDeclarationEvent,
} from "./event/index.js";
import { toErrorMessage } from "./utils/index.js";

const skip = Symbol.for("ObjectToSAXTransformStream.skip");

/**
 * Context passed to the `mapNode` callback of `ObjectToSAXTransformStream`.
 */
export type ObjectToSAXNodeContext = {
  /** Return this symbol from `mapNode` to skip emitting the current chunk. */
  skip: typeof skip
};

/**
 * Callback that maps an arbitrary input value into an `XMLNode`.
 */
export type ObjectToSAXNodeMapper<T> = (
  value: T,
  context: ObjectToSAXNodeContext,
) => XMLNode | typeof skip;

/**
 * Configuration options for `ObjectToSAXTransformStream`.
 */
export type ObjectToSAXTransformStreamOptions<T> = {
  /** Wrap each emitted top-level node in `startDocument` / `endDocument` (default: `true`). */
  makeDocument?: boolean
  /** Custom mapper from input values to `XMLNode`. */
  mapNode?: ObjectToSAXNodeMapper<T>
};

type Status = {
  get makeDocument(): boolean
};

/**
 * Error thrown by `ObjectToSAXTransformStream` when an invalid node, circular reference, or mapper error is encountered.
 */
export class ObjectToSAXTransformStreamError extends Error implements Status {
  makeDocument: boolean;

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "ObjectToSAXTransformStreamError";
    this.makeDocument = status.makeDocument;
  }
}

/**
 * A `TransformStream` that converts lightweight plain-object XML AST nodes (`XMLNode`) into a stream of SAX events.
 */
export class ObjectToSAXTransformStream<T = XMLNode> extends TransformStream<T, SAXEventInterface> {
  static readonly skip = skip;

  #makeDocument: boolean;
  #mapNode: ObjectToSAXNodeMapper<T> | undefined;
  #controller!: TransformStreamDefaultController<SAXEventInterface>;

  constructor(options?: ObjectToSAXTransformStreamOptions<T>) {
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
    this.#mapNode = options?.mapNode;
    this.#controller = controller_;
  }

  #status(): Status {
    return {
      makeDocument: this.#makeDocument,
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): ObjectToSAXTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new ObjectToSAXTransformStreamError(message as string, this.#status(), options);
  }

  * #emitChild(node: XMLChildNode, ancestors: Set<object>): Generator<SAXEventInterface, void, void> {
    if (ancestors.has(node)) {
      throw this.#makeError("Circular reference detected");
    }
    ancestors.add(node);
    try {
      switch (node.type) {
        case "element": {
          const children = node.children;
          const selfClosing = node.selfClosing ?? false;
          if (selfClosing && children.length > 0) {
            throw this.#makeError(`Self-closing element <${node.tagName}> cannot have children`);
          }
          yield new StartElementEvent(node.tagName, { ...node.attrs }, selfClosing);
          for (const child of children) {
            yield* this.#emitChild(child, ancestors);
          }
          yield new EndElementEvent(node.tagName);
          return;
        }
        case "text":
          yield new TextEvent(node.text);
          return;
        case "cdata":
          yield new CdataEvent(node.cdata);
          return;
        case "comment":
          yield new CommentEvent(node.comment);
          return;
        case "processingInstruction": {
          if (node.target === SAX_XML_DECLARATION_TARGET_TYPE && node.version !== undefined) {
            yield new XMLDeclarationEvent({
              target: SAX_XML_DECLARATION_TARGET_TYPE,
              version: node.version,
              encoding: node.encoding,
              standalone: node.standalone,
            });
            return;
          }
          if (
            node.target === SAX_XML_DECLARATION_STYLESHEET_TARGET_TYPE
            && node.contentType !== undefined
            && node.href !== undefined
          ) {
            yield new XMLStylesheetDeclarationEvent({
              target: SAX_XML_DECLARATION_STYLESHEET_TARGET_TYPE,
              contentType: node.contentType,
              href: node.href,
            });
            return;
          }
          yield new ProcessingInstructionEvent(node.target, node.data);
          return;
        }
        case "doctype": {
          const declarations = node.declarations ? [...node.declarations] : undefined;
          if (node.dtdType === "PUBLIC") {
            yield new DoctypePublicEvent(node.root, {
              dtdType: "PUBLIC",
              identifier: node.identifier,
              uri: node.uri,
              declarations,
            });
            return;
          }
          if (node.dtdType === "SYSTEM") {
            yield new DoctypeSystemEvent(node.root, {
              dtdType: "SYSTEM",
              uri: node.uri,
              declarations,
            });
            return;
          }
          yield new DoctypeSimpleEvent(node.root, { declarations });
          return;
        }
        default: {
          const exhaustive: never = node;
          throw this.#makeError(`Unknown XML node type: ${String((exhaustive as { type?: unknown }).type)}`);
        }
      }
    }
    finally {
      ancestors.delete(node);
    }
  }

  #transform(chunk: T): void {
    try {
      let node: XMLNode;
      if (this.#mapNode) {
        let mapped: XMLNode | typeof skip;
        try {
          mapped = this.#mapNode(chunk, { skip });
        }
        catch (e: unknown) {
          throw this.#makeError(e);
        }
        if (mapped === skip) return;
        node = mapped;
      }
      else {
        node = chunk as unknown as XMLNode;
      }

      if (typeof node !== "object" || node === null || typeof node.type !== "string") {
        throw this.#makeError("Invalid XML node");
      }

      const ancestors = new Set<object>();
      if (this.#makeDocument) {
        this.#controller.enqueue(new StartDocumentEvent());
      }
      if (node.type === "document") {
        ancestors.add(node);
        for (const child of node.children) {
          for (const event of this.#emitChild(child, ancestors)) {
            this.#controller.enqueue(event);
          }
        }
      }
      else {
        for (const event of this.#emitChild(node, ancestors)) {
          this.#controller.enqueue(event);
        }
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
