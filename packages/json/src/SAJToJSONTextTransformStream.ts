import { toErrorMessage } from "./utils/index.js";
import type {
  CommentSAJEventInterface,
  KeySAJEventInterface,
  SAJEventInterface,
  ValueBooleanSAJEventInterface,
  ValueNullSAJEventInterface,
  ValueNumberSAJEventInterface,
  ValueStringSAJEventInterface,
} from "./event-interface/index.js";

type ValueSAJEventInterface =
  | ValueNumberSAJEventInterface
  | ValueBooleanSAJEventInterface
  | ValueNullSAJEventInterface
  | ValueStringSAJEventInterface;

type Status = {
  get containerStack(): Stacks[]
  get firstItemStack(): boolean[]
  get pendingValueForKey(): boolean
  get summarize(): Summarize
  get indent(): string
  get lineBreak(): string
  get parts(): string[]
};

/**
 * Error thrown by `SAJToJSONTextTransformStream` when an invalid SAJ event sequence is encountered during serialization.
 */
export class SAJToJSONTextTransformStreamError extends Error implements Status {
  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAJToJSONTextTransformStreamError";
    this.containerStack = status.containerStack;
    this.firstItemStack = status.firstItemStack;
    this.pendingValueForKey = status.pendingValueForKey;
    this.summarize = status.summarize;
    this.indent = status.indent;
    this.lineBreak = status.lineBreak;
    this.parts = status.parts;
  }

  containerStack: Stacks[];
  firstItemStack: boolean[];
  pendingValueForKey: boolean;
  summarize: Summarize;
  indent: string;
  lineBreak: string;
  parts: string[];
}

/**
 * Configuration options for `SAJToJSONTextTransformStream`.
 */
export type SAJToJSONTextTransformStreamOptions = {
  /** json text is document summarize */
  summarize: boolean | Summarize
  /** indent size or indent character */
  indent: number | string
  /** line break character (defaults to "\n" when indent is set) */
  lineBreak: string
  /** whether to emit comment events as JSONC comments (defaults to false) */
  comments: boolean
};
const stacks = Object.freeze({
  object: "object",
  array: "array",
  document: "document",
} as const);
type Stacks = typeof stacks[keyof typeof stacks];
const summarize = Object.freeze({
  /** default type: minimal */
  default: "default",
  /** For each empty containerStack */
  normal: "normal",
  /** For each document start/end unit */
  document: "document",
} as const);
/** JSON Text summarize unit types */
type Summarize = typeof summarize[keyof typeof summarize];

/**
 * TransformStream that serializes a stream of SAJ events into JSON text chunks.
 */
export class SAJToJSONTextTransformStream extends TransformStream<SAJEventInterface, string> {
  #controller!: TransformStreamDefaultController<string>;

  /** The type of container currently nested（"object" | "array" | "document"） */
  #containerStack: Stacks[] = [];
  /** Whether it is the first element for each container (true = no element has appeared yet) */
  #firstItemStack: boolean[] = [];
  /** Flag to suppress commas in the value/structure immediately following the key */
  #pendingValueForKey = false;
  /** JSON Text summarize unit */
  #summarize: Summarize;
  /** Indent unit string */
  #indent: string;
  /** Line break string */
  #lineBreak: string;
  #comments: boolean;
  #parts: string[] = [];

  #status() {
    return {
      containerStack: structuredClone(this.#containerStack),
      firstItemStack: structuredClone(this.#firstItemStack),
      pendingValueForKey: this.#pendingValueForKey,
      summarize: this.#summarize,
      indent: this.#indent,
      lineBreak: this.#lineBreak,
      parts: structuredClone(this.#parts),
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status() {
    return this.#status();
  }

  constructor({ summarize, indent, lineBreak, comments }: Partial<SAJToJSONTextTransformStreamOptions> = {}) {
    let controller_!: TransformStreamDefaultController<string>;
    super({
      start: (controller) => {
        controller_ = controller;
      },
      transform: (chunk) => {
        this.#enqueue(chunk);
      },
      flush: () => {
        this.#flush();
      },
    });
    this.#controller = controller_;
    this.#summarize = this.#toSummarize(summarize);
    this.#indent = typeof indent === "number"
      ? (indent > 0 ? " ".repeat(indent) : "")
      : (indent ?? "");
    this.#lineBreak = lineBreak ?? (this.#indent ? "\n" : "");
    this.#comments = comments ?? false;
  }

  #toSummarize(value?: SAJToJSONTextTransformStreamOptions["summarize"]): Summarize {
    if (typeof value === "boolean")
      return value ? summarize.normal : summarize.default;
    if (!value) return summarize.default;
    return value;
  }

  #flush(): void {
    if (this.#containerStack.length === 0 && this.#parts.length === 0) return;
    throw this.#makeError("Incomplete JSON structure");
  }

  #enqueue(chunk: SAJEventInterface): void {
    try {
      const parts = this.#next(chunk);
      if (!parts) return;
      if (this.#summarize === summarize.default) {
        for (const part of parts) {
          this.#controller.enqueue(part);
        }
      }
      else {
        this.#parts.push(...parts);
      }
      if (this.#summarize === summarize.normal) {
        if (
          (
            this.#containerStack.length === 0
            || (
              this.#containerStack.at(0) === stacks.document
              && this.#containerStack.length === 1
            )
          ) && this.#parts.length > 0
        ) {
          const json = this.#parts.splice(0, this.#parts.length).join("");
          this.#controller.enqueue(json);
        }
      }
    }
    catch (e: unknown) {
      this.#controller.error(e);
      throw e;
    }
  }

  #next(chunk: SAJEventInterface): string[] | undefined {
    switch (chunk.name) {
      case "startDocument":
        return this.#startDocument();
      case "endDocument":
        return this.#endDocument();
      case "startObject":
        return this.#startStructure("object");
      case "startArray":
        return this.#startStructure("array");
      case "endObject":
        return this.#endStructure("object");
      case "endArray":
        return this.#endStructure("array");
      case "key":
        return this.#key(chunk);
      case "value":
        return this.#value(chunk);
      case "comment":
        return this.#comment(chunk);
      case "error":
        return this.#error();
    }
  }

  #comment({ comment, style }: CommentSAJEventInterface): string[] | undefined {
    if (!this.#comments) return undefined;
    const out: string[] = [];
    if (this.#firstItemStack.length > 0 && !this.#pendingValueForKey) {
      const prefix = this.#makeIndentPrefix();
      if (prefix) out.push(prefix);
    }
    if (style === "line") {
      out.push(`//${comment}${this.#lineBreak || "\n"}`);
    }
    else {
      out.push(`/*${comment}*/`);
    }
    return out;
  }

  #error(): undefined {
    const inDocument = this.#containerStack.at(0) === stacks.document;
    this.#containerStack = inDocument ? [stacks.document] : [];
    this.#firstItemStack = [];
    this.#pendingValueForKey = false;
    this.#parts = [];
  }

  #makeError(message: string | Error, options?: ErrorOptions) {
    ({ message, options } = toErrorMessage(message, options));
    return new SAJToJSONTextTransformStreamError(message, this.#status(), options);
  }

  #startDocument(): undefined {
    if (this.#containerStack.length > 0) throw this.#makeError("invalid startDocument");
    this.#containerStack.push(stacks.document);
  }

  #makeIndentPrefix(): string {
    if (!this.#lineBreak && !this.#indent) return "";
    return `${this.#lineBreak}${this.#indent.repeat(this.#firstItemStack.length)}`;
  }

  #startStructure(type: typeof stacks.array | typeof stacks.object): string[] {
    if (this.#peekContainerIsObject() && !this.#pendingValueForKey) {
      throw this.#makeError(`Unexpected start${type} in object without key`);
    }
    const out: string[] = [];
    // Suppress comma and indentation immediately after an object key (#pendingValueForKey is true)
    if (!this.#pendingValueForKey) {
      if (!this.#isFirstItem()) {
        out.push(",");
      }
      if (this.#firstItemStack.length > 0) {
        const prefix = this.#makeIndentPrefix();
        if (prefix) out.push(prefix);
      }
    }
    out.push(type === stacks.object ? "{" : "[");
    // Enter new container
    this.#containerStack.push(type);
    this.#firstItemStack.push(true);
    // Keep firstItem = true for the first element inside the new container
    // Mark the parent container as having emitted an item
    this.#markParentNotFirstItem();
    // Reset since the structure following the key has been consumed
    this.#pendingValueForKey = false;
    return out;
  }

  #endDocument(): undefined {
    const type = stacks.document;
    const top = this.#containerStack.pop();
    if (top !== type) {
      const error = this.#makeError(`Mismatched end${type}, expected to close ${top}`);
      Object.assign(error as unknown as Record<string, unknown>, { type, top });
      throw error;
    }
    if (this.#summarize === summarize.document && this.#parts.length > 0) {
      const parts = this.#parts.splice(0, this.#parts.length).join("");
      this.#controller.enqueue(parts);
    }
  }

  #endStructure(type: typeof stacks.array | typeof stacks.object): string[] {
    if (this.#pendingValueForKey) {
      throw this.#makeError(`Unexpected end${type} while expecting value for key`);
    }
    const out: string[] = [];
    const top = this.#containerStack.pop();
    const wasEmpty = this.#firstItemStack.pop();
    if (top !== type) {
      const error = this.#makeError(`Mismatched end${type}, expected to close ${top}`);
      Object.assign(error as unknown as Record<string, unknown>, { type, top });
      throw error;
    }
    if (!wasEmpty) {
      const prefix = this.#makeIndentPrefix();
      if (prefix) out.push(prefix);
    }
    out.push(type === stacks.object ? "}" : "]");
    // This structure is an item in its parent, so the parent will need a comma before the next item
    this.#markNotFirstItem();
    // Not immediately after a key once the structure ends
    this.#pendingValueForKey = false;
    return out;
  }

  #key({ key }: KeySAJEventInterface): string[] {
    if (!this.#peekContainerIsObject()) {
      const error = this.#makeError("Key event outside of object");
      Object.assign(error as unknown as Record<string, unknown>, { key });
      throw error;
    }
    if (this.#pendingValueForKey) {
      const error = this.#makeError("Unexpected key while expecting value");
      Object.assign(error as unknown as Record<string, unknown>, { key });
      throw error;
    }
    const out: string[] = [];
    if (!this.#isFirstItem()) {
      out.push(",");
    }
    const prefix = this.#makeIndentPrefix();
    if (prefix) out.push(prefix);
    out.push(JSON.stringify(key) + (this.#indent ? ": " : ":"));
    // Suppress comma for the value/structure immediately following a key
    this.#pendingValueForKey = true;
    // The key starts a key:value pair, so the current container is no longer on its first item
    this.#markNotFirstItem();
    return out;
  }

  #value(chunk: ValueSAJEventInterface): string[] {
    if (this.#peekContainerIsObject() && !this.#pendingValueForKey) {
      const error = this.#makeError("Unexpected value in object without key");
      Object.assign(error as unknown as Record<string, unknown>, { chunk });
      throw error;
    }
    const out: string[] = [];

    // Handle comma and indentation for regular values (inside an array or as an object value)
    if (!this.#pendingValueForKey) {
      if (!this.#isFirstItem()) {
        out.push(",");
      }
      if (this.#firstItemStack.length > 0) {
        const prefix = this.#makeIndentPrefix();
        if (prefix) out.push(prefix);
      }
    }

    let serialized: string;
    switch (chunk.type) {
      case "boolean":
        serialized = String(chunk.value);
        break;
      case "number":
        if (!Number.isFinite(chunk.value)) {
          const error = this.#makeError(`Invalid non-finite number: ${String(chunk.value)}`);
          Object.assign(error as unknown as Record<string, unknown>, { chunk });
          throw error;
        }
        serialized = String(chunk.value);
        break;
      case "null":
        serialized = "null";
        break;
      case "string":
        serialized = JSON.stringify(chunk.value);
        break;
      default: {
        const error = this.#makeError(`Unknown value type: ${String((chunk as { type: unknown }).type)}`);
        Object.assign(error as unknown as Record<string, unknown>, { chunk });
        throw error;
      }
    }
    out.push(serialized);
    // A value has been emitted, so a comma will be needed before the next item
    this.#markNotFirstItem();
    // Reset since the value following the key has been consumed
    this.#pendingValueForKey = false;
    return out;
  }

  #isFirstItem(): boolean {
    if (this.#firstItemStack.length === 0) return true;
    return this.#firstItemStack.at(-1)!;
  }

  #markNotFirstItem() {
    if (this.#firstItemStack.length === 0) return;
    this.#firstItemStack[this.#firstItemStack.length - 1] = false;
  }

  // Mark the parent container as no longer on its first item (called when emitting a structure or value)
  #markParentNotFirstItem() {
    if (this.#firstItemStack.length < 2) return;
    this.#firstItemStack[this.#firstItemStack.length - 2] = false;
  }

  #peekContainerIsObject(): boolean {
    if (this.#containerStack.length === 0) return false;
    return this.#containerStack.at(-1) === stacks.object;
  }
}
