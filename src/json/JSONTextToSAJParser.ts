import type { SimpleApiParser } from "../interface/index.js";
import { assertIsDefined, assertIsTrue, toErrorMessage } from "../utils/index.js";
import { EndArrayEvent, EndDocumentEvent, EndObjectEvent, KeyEvent, StartArrayEvent, StartDocumentEvent, StartObjectEvent, ValueBooleanEvent, ValueNullEvent, ValueNumberEvent, ValueStringEvent } from "./event/index.js";
import type { SAJHandler } from "./interface/index.js";

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

export type JSONTextToSAJParserAdditionalHandler = {
  onParseBefore(arg: Status): void
  onParseRoopBefore(arg: Status): void
  onParseRoopAfter(arg: Status): void
  onParseAfter(arg: Status): void
};
const EOL = Symbol.for("JSONTextToSAJParser.EOL");

type Ch = string | typeof EOL;

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
  #key: string | null = null;
  #stack: ("object" | "array")[] = [];
  #handler: Partial<SAJHandler & JSONTextToSAJParserAdditionalHandler>;
  #skipDocument: boolean;
  #startDocumented: boolean = false;
  #multiple: boolean = false;

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

  constructor({ handler, skipDocument, multiple }: { handler: Partial<SAJHandler & JSONTextToSAJParserAdditionalHandler>, skipDocument?: boolean, multiple?: boolean }) {
    this.#handler = handler;
    this.#skipDocument = skipDocument ?? false;
    this.#multiple = multiple ?? false;
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

  enqueue(chunk: string): void {
    this.#buffer += chunk;
    this.#parse();
  }

  flush(): void {
    this.#parse(true);
  }

  #parse(isFlush = false) {
    this.#handler.onParseBefore?.(this.#status());
    try {
      while (this.#pos < this.#buffer.length) {
        this.#handler.onParseRoopBefore?.(this.#status());
        const ch = this.#buffer[this.#pos++];
        this.#state(ch);
        this.#handler.onParseRoopAfter?.(this.#status());
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
    }
    catch (e: unknown) {
      this.#handler.onError?.(e);
    }
    finally {
      this.#handler.onParseAfter?.(this.#status());
    }
  }

  #endDocument(ch: Ch) {
    if (ch !== EOL && /\s/.test(ch)) return;
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
    if (ch === EOL) return;
    if (/\s/.test(ch)) return;

    if (!this.#skipDocument)
      this.#handler.onStartDocument?.(new StartDocumentEvent());
    this.#startDocumented = true;
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

  #parseKeyOrEndObject(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (/\s/.test(ch)) return;
    if (ch === "}") {
      this.#handler.onEndObject?.(new EndObjectEvent());
      this.#stack.pop();
      this.#setState(this.#parseAfterValue, "AfterValue");
      return;
    }
    else if (ch === "\"") {
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

  #parseColon(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (/\s/.test(ch)) return;
    if (ch === ":") {
      this.#setState(this.#parseValue, "Value");
      return;
    }
    throw this.#makeSyntaxError(`Expected colon after key but got`, ch);
  };

  #parseValue(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (/\s/.test(ch)) return;

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
    if (/\s/.test(ch)) return;
    if (ch === ",") {
      this.#setState(this.#parseKeyOrEndObject, "KeyOrEndObject");
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
    if (/\s/.test(ch)) return;
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
    this.#parseValue(ch);
  };

  #parseCommaOrEndArray(ch: Ch) {
    if (ch === EOL) throw this.#makeNotCompleteError();
    if (/\s/.test(ch)) return;
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
    if (ch !== EOL && /\s/.test(ch)) return;
    if (this.#stack.length === 0) {
      this.#endDocument(ch);
      return;
    }
    if (ch === EOL) {
      // まだ未閉じの構造がある → 不完全エラー
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

  #parseString(onEnd: (this: typeof this, s: string) => void): StateFunction {
    let escape = false;
    let unicode: string | null = null;
    const parseStringHandler: StateFunction = (ch) => {
      if (ch === EOL) throw this.#makeNotCompleteError();
      if (escape) {
        if (unicode !== null) {
          // unicode モード中
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
          // unicode エスケープ開始
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
        const num = Number(this.#acc);
        if (Number.isNaN(num)) {
          throw this.#makeSyntaxError(`Invalid number`, this.#acc);
        }
        this.#setState(this.#endDocument, "#endDocument");
        onEnd.call(this, num);
      }
    };
    return parseNumberHandler;
  };
}
