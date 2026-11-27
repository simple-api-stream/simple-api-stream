import type { SAYEventInterface, ScalarSAYEventInterface } from "./event-interface/index.js";
import { toErrorMessage } from "./utils/index.js";

const summarize = Object.freeze({
  default: "default",
  document: "document",
} as const);
type Summarize = typeof summarize[keyof typeof summarize];

/**
 * Configuration options for `SAYToYAMLTextTransformStream`.
 */
export type SAYToYAMLTextTransformStreamOptions = {
  /** Number of spaces per indentation level (default: `2`). */
  indent?: number
  /** Line break string (default: `"\n"`). */
  lineBreak?: string
  /** Emit `comment` events as `# ...` lines (default: `false`). */
  comments?: boolean
  /** Always emit `---` at the start of each document (default: `false`; still emitted automatically between multiple documents). */
  documentStart?: boolean
  /** Output granularity: `"default"` (`false`) or `"document"` (`true`). */
  summarize?: boolean | Summarize
};

type Frame = {
  type: "mapping" | "sequence"
  flow: boolean
  depth: number
  count: number
  expectingValue: boolean
  pendingHeader: string | null
};

type Status = {
  get options(): SAYToYAMLTextTransformStreamOptions | undefined
  get inDocument(): boolean
  get summarize(): Summarize
  get parts(): string[]
};

/**
 * Error thrown by `SAYToYAMLTextTransformStream` when an invalid SAY event sequence or option is encountered.
 */
export class SAYToYAMLTextTransformStreamError extends Error implements Status {
  options: SAYToYAMLTextTransformStreamOptions | undefined;
  inDocument: boolean;
  summarize: Summarize;
  parts: string[];

  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "SAYToYAMLTextTransformStreamError";
    ({
      options: this.options,
      inDocument: this.inDocument,
      summarize: this.summarize,
      parts: this.parts,
    } = status);
  }
}

const RESERVED_PLAIN_RE = /^(?:|~|null|Null|NULL|true|True|TRUE|false|False|FALSE|[-+]?[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+|[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
const SAFE_PLAIN_RE = /^[A-Za-z0-9_./+-][A-Za-z0-9_ ./+-]*$/;

function formatStringScalar(value: string, forceQuote: boolean): string {
  if (
    !forceQuote
    && value.length > 0
    && value === value.trim()
    && !RESERVED_PLAIN_RE.test(value)
    && SAFE_PLAIN_RE.test(value)
    && !value.includes(": ")
    && !value.includes(" #")
    && !value.endsWith(":")
  ) {
    return value;
  }
  return JSON.stringify(value);
}

function formatKey(key: string): string {
  return formatStringScalar(key, false);
}

function formatMetaPrefix(meta: { anchor?: string, tag?: string }): string {
  let prefix = "";
  if (meta.anchor !== undefined) prefix += `&${meta.anchor} `;
  if (meta.tag !== undefined) prefix += `${meta.tag} `;
  return prefix;
}

function formatScalar(event: ScalarSAYEventInterface, inFlow: boolean): string {
  const prefix = formatMetaPrefix(event);
  switch (event.type) {
    case "null":
      return `${prefix}null`;
    case "boolean":
      return `${prefix}${event.value ? "true" : "false"}`;
    case "number": {
      const n = event.value;
      if (Number.isNaN(n)) return `${prefix}.nan`;
      if (n === Number.POSITIVE_INFINITY) return `${prefix}.inf`;
      if (n === Number.NEGATIVE_INFINITY) return `${prefix}-.inf`;
      return `${prefix}${String(n)}`;
    }
    case "string": {
      const forceQuote = inFlow || event.style === "double" || event.style === "single";
      return `${prefix}${formatStringScalar(event.value, forceQuote)}`;
    }
  }
}

/**
 * A `TransformStream` that serializes SAY (Simple API for YAML) events back into YAML text.
 */
export class SAYToYAMLTextTransformStream extends TransformStream<SAYEventInterface, string> {
  #options: SAYToYAMLTextTransformStreamOptions | undefined;
  #indent: number;
  #lineBreak: string;
  #comments: boolean;
  #documentStart: boolean;
  #summarize: Summarize;

  #inDocument = false;
  #documentCount = 0;
  #stack: Frame[] = [];
  #parts: string[] = [];
  #controller!: TransformStreamDefaultController<string>;

  constructor(options?: SAYToYAMLTextTransformStreamOptions) {
    let controller_!: TransformStreamDefaultController<string>;
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
    this.#options = options;
    this.#indent = options?.indent ?? 2;
    this.#lineBreak = options?.lineBreak ?? "\n";
    this.#comments = options?.comments ?? false;
    this.#documentStart = options?.documentStart ?? false;
    this.#summarize = options?.summarize === true
      ? summarize.document
      : options?.summarize === false || options?.summarize === undefined
        ? summarize.default
        : options.summarize;

    if (!Number.isInteger(this.#indent) || this.#indent < 1) {
      throw this.#makeError("indent must be a positive integer");
    }
  }

  #status(): Status {
    return {
      options: this.#options,
      inDocument: this.#inDocument,
      summarize: this.#summarize,
      parts: this.#parts.slice(),
    };
  }

  /**
   * Returns the current serializer status snapshot.
   */
  get status(): Status {
    return this.#status();
  }

  #makeError(message: unknown, options?: ErrorOptions): SAYToYAMLTextTransformStreamError {
    ({ message, options } = toErrorMessage(message, options));
    return new SAYToYAMLTextTransformStreamError(message as string, this.#status(), options);
  }

  #emit(text: string): void {
    if (this.#summarize === summarize.document) {
      this.#parts.push(text);
    }
    else {
      this.#controller.enqueue(text);
    }
  }

  #flushParts(): void {
    if (this.#parts.length > 0) {
      this.#controller.enqueue(this.#parts.join(""));
      this.#parts = [];
    }
  }

  #indentStr(depth: number): string {
    return " ".repeat(depth * this.#indent);
  }

  #materializePendingHeaders(): void {
    for (const frame of this.#stack) {
      if (frame.pendingHeader !== null) {
        this.#emit(frame.pendingHeader);
        frame.pendingHeader = null;
      }
    }
  }

  #prepareValueSlot(inline: boolean): { inFlow: boolean, parent: Frame | undefined } {
    this.#materializePendingHeaders();
    const parent = this.#stack[this.#stack.length - 1];
    if (!parent) return { inFlow: false, parent: undefined };

    if (parent.flow) {
      if (parent.type === "sequence") {
        if (parent.count > 0) this.#emit(", ");
        parent.count++;
      }
      else {
        parent.expectingValue = false;
      }
      return { inFlow: true, parent };
    }

    if (parent.type === "sequence") {
      this.#emit(`${this.#indentStr(parent.depth)}- `);
      parent.count++;
    }
    else {
      parent.expectingValue = false;
      if (inline) {
        this.#emit(" ");
      }
    }
    return { inFlow: false, parent };
  }

  #startCollection(
    type: "mapping" | "sequence",
    event: { flow?: boolean, anchor?: string, tag?: string },
  ): void {
    const parentBefore = this.#stack[this.#stack.length - 1];
    const willBeFlow = (parentBefore?.flow === true) || event.flow === true;
    const { inFlow, parent } = this.#prepareValueSlot(willBeFlow);
    const flow = inFlow || event.flow === true;
    const metaPrefix = formatMetaPrefix(event);

    if (flow) {
      this.#emit(`${metaPrefix}${type === "mapping" ? "{" : "["}`);
      this.#stack.push({
        type,
        flow: true,
        depth: parent ? parent.depth + 1 : 0,
        count: 0,
        expectingValue: false,
        pendingHeader: null,
      });
      return;
    }

    const depth = parent ? parent.depth + 1 : 0;
    const trimmedMeta = metaPrefix.trimEnd();
    const pendingHeader = parent
      ? (trimmedMeta.length > 0 ? ` ${trimmedMeta}${this.#lineBreak}` : this.#lineBreak)
      : (trimmedMeta.length > 0 ? `${trimmedMeta}${this.#lineBreak}` : null);

    this.#stack.push({
      type,
      flow: false,
      depth,
      count: 0,
      expectingValue: false,
      pendingHeader,
    });
  }

  #endCollection(type: "mapping" | "sequence"): void {
    const frame = this.#stack.pop();
    if (!frame || frame.type !== type) {
      throw this.#makeError(`Unexpected end${type === "mapping" ? "Mapping" : "Sequence"}`);
    }
    if (frame.expectingValue) {
      throw this.#makeError("Unexpected endMapping while awaiting value");
    }
    if (frame.flow) {
      this.#emit(type === "mapping" ? "}" : "]");
      const outer = this.#stack[this.#stack.length - 1];
      if (!outer || !outer.flow) {
        this.#emit(this.#lineBreak);
      }
      return;
    }
    if (frame.count === 0) {
      const emptyLiteral = type === "mapping" ? "{}" : "[]";
      const outer = this.#stack[this.#stack.length - 1];
      const leadSpace = outer && !outer.flow && outer.type === "mapping" ? " " : "";
      const meta = frame.pendingHeader ? frame.pendingHeader.trim() : "";
      const prefix = meta.length > 0 ? `${meta} ` : "";
      this.#emit(`${leadSpace}${prefix}${emptyLiteral}${this.#lineBreak}`);
    }
  }

  #transform(event: SAYEventInterface): void {
    switch (event.name) {
      case "startDocument":
        if (this.#inDocument) {
          throw this.#makeError("Unexpected startDocument while already in document");
        }
        this.#inDocument = true;
        if (this.#documentStart || this.#documentCount > 0) {
          this.#emit(`---${this.#lineBreak}`);
        }
        this.#documentCount++;
        break;
      case "endDocument":
        if (!this.#inDocument) {
          throw this.#makeError("Unexpected endDocument outside document");
        }
        if (this.#stack.length > 0) {
          throw this.#makeError("Unexpected endDocument with unclosed collection");
        }
        this.#inDocument = false;
        this.#flushParts();
        break;
      case "comment":
        if (this.#comments) {
          this.#materializePendingHeaders();
          const top = this.#stack[this.#stack.length - 1];
          const indent = top && !top.flow ? this.#indentStr(top.depth) : "";
          this.#emit(`${indent}#${event.comment}${this.#lineBreak}`);
        }
        break;
      case "startMapping":
        this.#startCollection("mapping", event);
        break;
      case "endMapping":
        this.#endCollection("mapping");
        break;
      case "startSequence":
        this.#startCollection("sequence", event);
        break;
      case "endSequence":
        this.#endCollection("sequence");
        break;
      case "key": {
        this.#materializePendingHeaders();
        const top = this.#stack[this.#stack.length - 1];
        if (!top || top.type !== "mapping") {
          throw this.#makeError("Unexpected key outside mapping");
        }
        if (top.expectingValue) {
          throw this.#makeError("Unexpected key while previous key is awaiting value");
        }
        if (top.flow) {
          if (top.count > 0) this.#emit(", ");
          this.#emit(`${formatKey(event.key)}: `);
        }
        else {
          this.#emit(`${this.#indentStr(top.depth)}${formatKey(event.key)}:`);
        }
        top.count++;
        top.expectingValue = true;
        break;
      }
      case "scalar": {
        const { inFlow } = this.#prepareValueSlot(true);
        this.#emit(formatScalar(event, inFlow));
        if (!inFlow) {
          this.#emit(this.#lineBreak);
        }
        break;
      }
      case "alias": {
        const { inFlow } = this.#prepareValueSlot(true);
        this.#emit(`*${event.alias}`);
        if (!inFlow) {
          this.#emit(this.#lineBreak);
        }
        break;
      }
    }
  }

  #flush(): void {
    if (this.#stack.length > 0) {
      throw this.#makeError("Unexpected end of stream with unclosed collection");
    }
    this.#flushParts();
  }
}
