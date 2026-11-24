import type { SimpleApiParser } from "@simple-api-stream/core";
import { assertIsDefined, assertIsTrue, toErrorMessage } from "./utils/index.js";
import { CommentEvent, EndArrayEvent, EndDocumentEvent, EndObjectEvent, ErrorEvent, KeyEvent, StartArrayEvent, StartDocumentEvent, StartObjectEvent, ValueBooleanEvent, ValueNullEvent, ValueNumberEvent, ValueStringEvent } from "./event/index.js";
import type { SAJHandler } from "./interface/index.js";

/**
 * Error thrown by `JSONTextToSAJParser` when malformed JSON syntax or an unexpected state is encountered.
 */
export class JSONTextToSAJParserError extends Error implements Status {
  buffer: string;
  pos: number;
  state: string;
  acc: string;
  key: string | null;
  typeStack: ("object" | "array")[];
  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "JSONTextToSAJParserError";
    ({
      buffer: this.buffer,
      pos: this.pos,
      state: this.state,
      acc: this.acc,
      key: this.key,
      typeStack: this.typeStack,
    } = status);
  }
}

type StateFunction = (ch: Ch) => void;
type Status = {
  get buffer(): string
  get pos(): number
  get state(): string
  get acc(): string
  get key(): string | null
  get typeStack(): ("object" | "array")[]
};

/**
 * Optional lifecycle hook callbacks invoked during `JSONTextToSAJParser` parsing.
 */
export type JSONTextToSAJParserAdditionalHandler = {
  onParseBefore(arg: Status): void
  onParseLoopBefore(arg: Status): void
  onParseLoopAfter(arg: Status): void
  onParseAfter(arg: Status): void
};
const EOL = Symbol.for("JSONTextToSAJParser.EOL");
const JSON_NUMBER_REGEX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

function isJsonWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

type Ch = string | typeof EOL;

/**
 * Options controlling multi-document and JSON Text Sequence (`json-seq`) parsing in `JSONTextToSAJParser`.
 */
export type JSONTextToSAJParserMultipleOptions =
  | { multiple?: boolean, errorToEvent?: never }
  | { multiple: "json-seq", errorToEvent?: boolean };

/**
 * Streaming JSON parser that emits SAJ events to a handler as text chunks are enqueued.
 */
export class JSONTextToSAJParser implements SimpleApiParser<string> {
  /** text buffer */
  #buffer = "";
  /** read position */
  #pos = 0;
  /** read state */
  #state: StateFunction = this.#startDocument;
  #stateName = "#startDocument";

  #setState(state: StateFunction, name: string) {
    this.#state = state;
    this.#stateName = name;
  }

  #acc = "";
  #commentAcc = "";
  #key: string | null = null;
  #stack: ("object" | "array")[] = [];
  #handler: Partial<SAJHandler & JSONTextToSAJParserAdditionalHandler>;
  #skipDocument: boolean;
  #startDocumented: boolean = false;
  #multiple: boolean | "json-seq" = false;
  #errorToEvent: boolean = false;
  #allowComments: boolean = false;
  #allowTrailingCommas: boolean = false;

  #status(): Status {
    return {
      buffer: this.#buffer,
      pos: this.#pos,
      state: this.#stateName,
      acc: this.#acc,
      key: this.#key,
      typeStack: this.#stack.slice(),
    };
  }

  /**
   * Returns the current parser status snapshot.
   */
  get status() {
    return this.#status();
  }

  /**
   * make error new SimpleSAXParseXMLBufferError
   * @param message error message
   * @param options error option
   * @returns
   */
  #makeError(message: string | Error, options?: ErrorOptions) {
    ({ message, options } = toErrorMessage(message, options));
    return new JSONTextToSAJParserError(message, this.#status(), options);
  }

  constructor({ handler, skipDocument, multiple, errorToEvent, allowComments, allowTrailingCommas }: { handler: Partial<SAJHandler & JSONTextToSAJParserAdditionalHandler>, skipDocument?: boolean, allowComments?: boolean, allowTrailingCommas?: boolean } & JSONTextToSAJParserMultipleOptions) {
    this.#handler = handler;
    this.#skipDocument = skipDocument ?? false;
    this.#multiple = multiple ?? false;
    this.#errorToEvent = this.#multiple === "json-seq" && (errorToEvent ?? false);
    this.#allowComments = allowComments ?? false;
    this.#allowTrailingCommas = allowTrailingCommas ?? false;
  }

  /**
   * make syntax error
   * @param message
   * @param source
   * @returns
   */
  #makeSyntaxError(message: string, source: string) {
    const error = this.#makeError(`${message}: ${source}`);
    (error as unknown as Record<string, string>).syntax = source;
    return error;
  }

  /**
   * make not complete error
   * @returns
   */
  #makeNotCompleteError() {
    return this.#makeError(`not complete syntax error. buffer:${this.#buffer}`);
  }

  /**
   * Appends a JSON text chunk and parses available characters, emitting SAJ events.
   */
  enqueue(chunk: string): void {
    this.#buffer += chunk;
    this.#parse();
  }

  /**
   * Finalizes parsing of any remaining buffered characters and emits closing events.
   */
  flush(): void {
    this.#parse(true);
  }

  #parse(isFlush = false) {
    this.#handler.onParseBefore?.(this.#status());
    try {
      while (true) {
        try {
          while (this.#pos < this.#buffer.length) {
            this.#handler.onParseLoopBefore?.(this.#status());
            const ch = this.#buffer[this.#pos++];
            this.#state(ch);
            this.#handler.onParseLoopAfter?.(this.#status());
          }
          this.#buffer = "";
          this.#pos = 0;
          if (isFlush) {
            this.#state(EOL);
            if (this.#state === this.#endDocument) {
              this.#state(EOL);
            }
            assertIsTrue(this.#state === this.#startDocument, `finish state is startDocument`);
          }
          break;
        }
        catch (e: unknown) {
          if (this.#errorToEvent) {
            this.#handler.onErrorEvent?.(new ErrorEvent(e));
            this.#acc = "";
            this.#key = null;
            this.#stack = [];
            if (isFlush && this.#pos >= this.#buffer.length) {
              this.#endDocumentOnError();
              break;
            }
            this.#setState(this.#skipToNextRecord, "#skipToNextRecord");
            continue;
          }
          this.#handler.onError?.(e);
          break;
        }
      }
    }
    finally {
      this.#handler.onParseAfter?.(this.#status());
    }
  }

  #endDocumentOnError() {
    assertIsTrue(this.#startDocumented, "mismatch not start document");
    if (!this.#skipDocument)
      this.#handler.onEndDocument?.(new EndDocumentEvent());
    this.#startDocumented = false;
    this.#setState(this.#startDocument, "#startDocument");
  }

  #skipToNextRecord(ch: Ch) {
    if (ch !== EOL && ch !== "\x1E") return;
    this.#endDocumentOnError();
  }

  #endDocument(ch: Ch) {
    if (ch !== EOL && isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#endDocument, "#endDocument")) return;
    assertIsTrue(this.#startDocumented, "mismatch not start document");
    if (ch !== EOL) {
      this.#pos--;
    }
    if (!this.#skipDocument)
      this.#handler.onEndDocument?.(new EndDocumentEvent());
    this.#startDocumented = false;
    if (!this.#multiple && ch !== EOL) {
      this.#setState(this.#closedDocument, "#closedDocument");
      return;
    }
    this.#setState(this.#startDocument, "#startDocument");
  }

  #closedDocument() {
    throw this.#makeError("is closed document");
  }

  #startDocument(ch: Ch) {
    if (ch === EOL) {
      if (this.#startDocumented) {
        if (!this.#skipDocument)
          this.#handler.onEndDocument?.(new EndDocumentEvent());
        this.#startDocumented = false;
      }
      return;
    }
    if (isJsonWhitespace(ch)) return;
    if (this.#multiple === "json-seq" && ch === "\x1E") return;

    if (!this.#startDocumented) {
      if (!this.#skipDocument)
        this.#handler.onStartDocument?.(new StartDocumentEvent());
      this.#startDocumented = true;
    }
    if (this.#tryStartComment(ch, this.#startDocument, "#startDocument")) return;
    switch (ch) {
      case "{":
        this.#handler.onStartObject?.(new StartObjectEvent());
        this.#stack.push("object");
        this.#setState(this.#parseKeyOrEndObject, "KeyOrEndObject");
        return;
      case "[":
        this.#handler.onStartArray?.(new StartArrayEvent());
        this.#stack.push("array");
        this.#setState(this.#parseValueOrEndArray, "ValueOrEndArray");
        return;
      case "\"":
        this.#acc = "";
        this.#setState(this.#parseString(this.#handleStandaloneValue), "parseStringHandler");
        return;
      case "t":
      case "f":
      case "n":
        this.#acc = ch;
        this.#setState(this.#parseLiteral(this.#handleStandaloneValue), "parseLiteralHandler");
        return;
      case "-":
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        this.#acc = ch;
        this.#setState(this.#parseNumber(this.#handleStandaloneValue), "parseNumberHandler");
        return;
    }
    throw this.#makeSyntaxError(`Unexpected token`, ch);
  };

  #handleStandaloneValue<T extends number | string | boolean | null>(val: T) {
    this.#setState(this.#endDocument, "#endDocument");
    this.#handler.onValue?.(this.#wrapValue(val));
  };

  #wrapValue<T extends number | string | boolean | null>(val: T) {
    if (typeof val === "string") return new ValueStringEvent("string", val);
    if (typeof val === "number") return new ValueNumberEvent("number", val);
    if (typeof val === "boolean") return new ValueBooleanEvent("boolean", val);
    return new ValueNullEvent("null");
  }

  #parseKey(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#parseKey, "Key")) return;
    if (this.#allowTrailingCommas && ch === "}") {
      this.#handler.onEndObject?.(new EndObjectEvent());
      this.#stack.pop();
      this.#setState(this.#parseAfterValue, "AfterValue");
      return;
    }
    if (ch === "\"") {
      this.#acc = "";
      this.#setState(this.#parseString((key) => {
        this.#key = key;
        this.#handler.onKey?.(new KeyEvent(key));
        this.#setState(this.#parseColon, "Colon");
      }), "parseStringHandler");
      return;
    }
    throw this.#makeSyntaxError(`Unexpected token in object`, ch);
  };

  #parseKeyOrEndObject(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#parseKeyOrEndObject, "KeyOrEndObject")) return;
    if (ch === "}") {
      this.#handler.onEndObject?.(new EndObjectEvent());
      this.#stack.pop();
      this.#setState(this.#parseAfterValue, "AfterValue");
      return;
    }
    this.#parseKey(ch);
  };

  #parseColon(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#parseColon, "Colon")) return;
    if (ch === ":") {
      this.#setState(this.#parseValue, "Value");
      return;
    }
    throw this.#makeSyntaxError(`Expected colon after key but got`, ch);
  };

  #parseValue(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#parseValue, "Value")) return;

    switch (ch) {
      case "\"":
        this.#acc = "";
        this.#setState(this.#parseString(this.#emitKeyValue), "parseStringHandler");
        return;
      case "{":
        this.#handler.onStartObject?.(new StartObjectEvent());
        this.#stack.push("object");
        this.#setState(this.#parseKeyOrEndObject, "KeyOrEndObject");
        return;
      case "[":
        this.#handler.onStartArray?.(new StartArrayEvent());
        this.#stack.push("array");
        this.#setState(this.#parseValueOrEndArray, "ValueOrEndArray");
        return;
      case "t":
      case "f":
      case "n":
        this.#acc = ch;
        this.#setState(this.#parseLiteral(this.#emitKeyValue), "parseLiteralHandler");
        return;
      default:
        if (ch === "-" || /\d/.test(ch)) {
          this.#acc = ch;
          this.#setState(this.#parseNumber(this.#emitKeyValue), "parseNumberHandler");
          return;
        }
    }
    throw this.#makeSyntaxError(`Unexpected value`, ch);
  };

  #emitKeyValue<T extends string | number | boolean | null>(val: T) {
    this.#handler.onValue?.(this.#wrapValue(val));
    this.#key = null;
    const parent = this.#stack.at(-1);
    assertIsDefined(parent, "not have parent");
    if (parent === "object")
      this.#setState(this.#parseCommaOrEndObject, "CommaOrEndObject");
    else
      this.#setState(this.#parseCommaOrEndArray, "CommaOrEndArray");
  };

  #parseCommaOrEndObject(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#parseCommaOrEndObject, "CommaOrEndObject")) return;
    if (ch === ",") {
      this.#setState(this.#parseKey, "Key");
      return;
    }
    else if (ch === "}") {
      this.#handler.onEndObject?.(new EndObjectEvent());
      this.#stack.pop();
      this.#setState(this.#parseAfterValue, "AfterValue");
      return;
    }
    throw this.#makeSyntaxError(`Expected , or } but got`, ch);
  };

  #parseValueOrEndArray(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#parseValueOrEndArray, "ValueOrEndArray")) return;
    if (ch === "]") {
      this.#handler.onEndArray?.(new EndArrayEvent());
      this.#stack.pop();
      this.#setState(this.#parseAfterValue, "AfterValue");
      return;
    }

    this.#pos--; // unread
    this.#setState(this.#parseValueInArray, "ValueInArray");
  };

  #parseValueInArray(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#parseValueInArray, "ValueInArray")) return;
    if (this.#allowTrailingCommas && ch === "]") {
      this.#handler.onEndArray?.(new EndArrayEvent());
      this.#stack.pop();
      this.#setState(this.#parseAfterValue, "AfterValue");
      return;
    }
    this.#parseValue(ch);
  };

  #parseCommaOrEndArray(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (isJsonWhitespace(ch)) return;
    if (this.#tryStartComment(ch, this.#parseCommaOrEndArray, "CommaOrEndArray")) return;
    if (ch === ",") {
      this.#setState(this.#parseValueInArray, "ValueInArray");
      return;
    }
    else if (ch === "]") {
      this.#handler.onEndArray?.(new EndArrayEvent());
      this.#stack.pop();
      this.#setState(this.#parseAfterValue, "AfterValue");
      return;
    }
    throw this.#makeSyntaxError(`Expected , or ] but got`, ch);
  };

  #parseAfterValue(ch: Ch) {
    if (ch !== EOL && isJsonWhitespace(ch)) return;
    if (this.#stack.length === 0) {
      this.#endDocument(ch);
      return;
    }
    if (this.#tryStartComment(ch, this.#parseAfterValue, "AfterValue")) return;
    if (ch === EOL) {
      // Unclosed structures still remain -> incomplete error
      throw this.#makeNotCompleteError();
    }
    const parent = this.#stack.at(-1);
    assertIsDefined(parent, "not have parent");
    if (parent === "object") {
      this.#pos--;
      this.#setState(this.#parseCommaOrEndObject, "CommaOrEndObject");
      return;
    }
    this.#pos--;
    this.#setState(this.#parseCommaOrEndArray, "CommaOrEndArray");
  };

  #tryStartComment(ch: Ch, resumeState: StateFunction, resumeStateName: string): boolean {
    if (!this.#allowComments || ch !== "/") return false;
    this.#setState(this.#parseCommentSlash(resumeState, resumeStateName), "parseCommentSlash");
    return true;
  }

  #parseCommentSlash(resumeState: StateFunction, resumeStateName: string): StateFunction {
    return (ch) => {
      if (ch === "/") {
        this.#commentAcc = "";
        this.#setState(this.#parseLineComment(resumeState, resumeStateName), "parseLineComment");
        return;
      }
      if (ch === "*") {
        this.#commentAcc = "";
        this.#setState(this.#parseBlockComment(resumeState, resumeStateName), "parseBlockComment");
        return;
      }
      throw this.#makeSyntaxError("Unexpected token", `/${ch === EOL ? "" : ch}`);
    };
  }

  #parseLineComment(resumeState: StateFunction, resumeStateName: string): StateFunction {
    return (ch) => {
      if (ch === EOL || ch === "\n" || ch === "\r") {
        const comment = this.#commentAcc;
        this.#commentAcc = "";
        this.#setState(resumeState, resumeStateName);
        this.#handler.onComment?.(new CommentEvent(comment, "line"));
        if (ch === EOL) {
          resumeState.call(this, EOL);
        }
        return;
      }
      this.#commentAcc += ch;
    };
  }

  #parseBlockComment(resumeState: StateFunction, resumeStateName: string): StateFunction {
    let sawStar = false;
    return (ch) => {
      if (ch === EOL) throw this.#makeNotCompleteError();
      if (sawStar) {
        if (ch === "/") {
          const comment = this.#commentAcc;
          this.#commentAcc = "";
          this.#setState(resumeState, resumeStateName);
          this.#handler.onComment?.(new CommentEvent(comment, "block"));
          return;
        }
        if (ch === "*") {
          this.#commentAcc += "*";
          return;
        }
        this.#commentAcc += `*${ch}`;
        sawStar = false;
        return;
      }
      if (ch === "*") {
        sawStar = true;
        return;
      }
      this.#commentAcc += ch;
    };
  }

  #parseString(onEnd: (this: typeof this, s: string) => void): StateFunction {
    let escape = false;
    let unicode: string | null = null;
    const parseStringHandler: StateFunction = (ch) => {
      if (ch === EOL) throw this.#makeNotCompleteError();
      if (escape) {
        if (unicode !== null) {
          // Inside unicode escape sequence
          if (!/[0-9a-fA-F]/.test(ch)) {
            throw this.#makeSyntaxError(`Invalid unicode escape`, ch);
          }
          unicode += ch;
          if (unicode.length === 4) {
            this.#acc += String.fromCharCode(parseInt(unicode, 16));
            unicode = null;
            escape = false;
          }
        }
        else if (ch === "u") {
          // Start unicode escape sequence
          unicode = "";
        }
        else {
          const esc = {
            "\"": "\"",
            "\\": "\\",
            "/": "/",
            "b": "\b",
            "f": "\f",
            "n": "\n",
            "r": "\r",
            "t": "\t",
          }[ch];
          if (esc === undefined) throw this.#makeSyntaxError(`Invalid escape: \\${ch}`, ch);
          this.#acc += esc;
          escape = false;
        }
      }
      else if (ch === "\\") {
        escape = true;
      }
      else if (ch === "\"") {
        onEnd.call(this, this.#acc);
      }
      else if (ch.charCodeAt(0) < 0x20) {
        throw this.#makeSyntaxError(`Unescaped control character in string`, ch);
      }
      else {
        this.#acc += ch;
      }
    };
    return parseStringHandler;
  };

  #parseLiteral(onEnd: (this: typeof this, val: string | boolean | null) => void): StateFunction {
    const parseLiteralHandler: StateFunction = (ch) => {
      if (ch === EOL) throw this.#makeNotCompleteError();
      this.#acc += ch;
      if (/^(true|false|null)$/.test(this.#acc)) {
        const val = this.#acc === "true"
          ? true
          : this.#acc === "false" ? false : null;
        this.#setState(this.#endDocument, "#endDocument");
        onEnd.call(this, val);
      }
      else if (!["true", "false", "null"].some(prefix => prefix.startsWith(this.#acc))) {
        throw this.#makeSyntaxError(`Invalid literal`, this.#acc);
      }
    };
    return parseLiteralHandler;
  };

  #parseNumber(onEnd: (this: typeof this, val: number) => void): StateFunction {
    const parseNumberHandler: StateFunction = (ch) => {
      if (ch !== EOL && /[0-9eE+.-]/.test(ch)) {
        this.#acc += ch;
      }
      else {
        if (ch !== EOL)
          this.#pos--; // unread
        if (!JSON_NUMBER_REGEX.test(this.#acc)) {
          throw this.#makeSyntaxError(`Invalid number`, this.#acc);
        }
        const num = Number(this.#acc);
        this.#setState(this.#endDocument, "#endDocument");
        onEnd.call(this, num);
      }
    };
    return parseNumberHandler;
  };
}
