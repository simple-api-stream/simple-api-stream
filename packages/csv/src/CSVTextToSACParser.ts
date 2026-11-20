import type { SimpleApiParser } from "@simple-api-stream/core";
import {
  ColumnEvent,
  EndDocumentEvent,
  EndHeaderRowEvent,
  EndRecordRowEvent,
  StartDocumentEvent,
  StartHeaderRowEvent,
  StartRecordRowEvent,
} from "./event/index.js";
import type { SACHandler } from "./interface/index.js";
import { toErrorMessage } from "./utils/index.js";

const EOL = Symbol.for("CSVTextToSACParser.EOL");
type Ch = string | typeof EOL;
type StateFunction = (ch: Ch) => void;

type Status = {
  get buffer(): string
  get pos(): number
  get state(): string
  get acc(): string
  get rowIndex(): number
  get colIndex(): number
};

/**
 * Error thrown by `CSVTextToSACParser` when malformed CSV syntax or invalid options are encountered.
 */
export class CSVTextToSACParserError extends Error implements Status {
  buffer: string;
  pos: number;
  state: string;
  acc: string;
  rowIndex: number;
  colIndex: number;
  constructor(message: string, status: Status, options?: ErrorOptions) {
    super(message, options);
    this.name = "CSVTextToSACParserError";
    ({
      buffer: this.buffer,
      pos: this.pos,
      state: this.state,
      acc: this.acc,
      rowIndex: this.rowIndex,
      colIndex: this.colIndex,
    } = status);
  }
}

export type CSVTextToSACParserAdditionalHandler = {
  onParseBefore(arg: Status): void
  onParseLoopBefore(arg: Status): void
  onParseLoopAfter(arg: Status): void
  onParseAfter(arg: Status): void
};

export type CSVTextToSACParserOptions = {
  skipDocument?: boolean
  header?: boolean | string[]
  delimiter?: string
  quote?: string
  skipEmptyLines?: boolean
  stripBom?: boolean
};

/**
 * Streaming CSV parser that emits SAC events to a handler as text chunks are enqueued.
 */
export class CSVTextToSACParser implements SimpleApiParser<string> {
  #buffer = "";
  #pos = 0;
  #state: StateFunction = this.#rowStart;
  #stateName = "#rowStart";
  #acc = "";
  #rowIndex = 0;
  #colIndex = 0;
  #inRow = false;
  #inHeaderRow = false;
  #headerEmitted = false;
  #headers: string[] = [];
  #documentStarted = false;
  #bomChecked = false;
  #flushed = false;

  #handler: Partial<SACHandler & CSVTextToSACParserAdditionalHandler>;
  #skipDocument: boolean;
  #headerOption: boolean | string[];
  #delimiter: string;
  #quote: string;
  #skipEmptyLines: boolean;
  #stripBom: boolean;

  constructor({
    handler,
    skipDocument = false,
    header = false,
    delimiter = ",",
    quote = "\"",
    skipEmptyLines = false,
    stripBom = true,
  }: {
    handler: Partial<SACHandler & CSVTextToSACParserAdditionalHandler>
  } & CSVTextToSACParserOptions) {
    this.#handler = handler;
    this.#skipDocument = skipDocument;
    this.#headerOption = header;
    this.#delimiter = delimiter;
    this.#quote = quote;
    this.#skipEmptyLines = skipEmptyLines;
    this.#stripBom = stripBom;

    if (delimiter.length !== 1 || delimiter === "\r" || delimiter === "\n") {
      throw this.#makeError(`Invalid delimiter: ${JSON.stringify(delimiter)}`);
    }
    if (quote.length !== 1 || quote === "\r" || quote === "\n" || quote === delimiter) {
      throw this.#makeError(`Invalid quote: ${JSON.stringify(quote)}`);
    }
  }

  #setState(state: StateFunction, name: string) {
    this.#state = state;
    this.#stateName = name;
  }

  #status(): Status {
    return {
      buffer: this.#buffer,
      pos: this.#pos,
      state: this.#stateName,
      acc: this.#acc,
      rowIndex: this.#rowIndex,
      colIndex: this.#colIndex,
    };
  }

  get status(): Status {
    return this.#status();
  }

  #makeError(message: string | Error, options?: ErrorOptions): CSVTextToSACParserError {
    ({ message, options } = toErrorMessage(message, options));
    return new CSVTextToSACParserError(message, this.#status(), options);
  }

  #reportError(err: unknown): never {
    const error = err instanceof CSVTextToSACParserError ? err : this.#makeError(err as Error);
    this.#handler.onError?.(error);
    throw error;
  }

  #ensureDocumentStarted() {
    if (this.#documentStarted) return;
    this.#documentStarted = true;
    if (!this.#skipDocument) {
      this.#handler.onStartDocument?.(new StartDocumentEvent());
    }
    if (Array.isArray(this.#headerOption)) {
      this.#headers = [...this.#headerOption];
      this.#headerEmitted = true;
      this.#handler.onStartHeaderRow?.(new StartHeaderRowEvent());
      for (let i = 0; i < this.#headers.length; i++) {
        this.#handler.onColumn?.(new ColumnEvent(this.#headers[i], { index: i, quoted: false }));
      }
      this.#handler.onEndHeaderRow?.(new EndHeaderRowEvent());
    }
  }

  #startRow() {
    if (this.#headerOption === true && !this.#headerEmitted) {
      this.#inHeaderRow = true;
      this.#headers = [];
      this.#handler.onStartHeaderRow?.(new StartHeaderRowEvent());
    }
    else {
      this.#inHeaderRow = false;
      this.#handler.onStartRecordRow?.(new StartRecordRowEvent());
    }
    this.#inRow = true;
    this.#colIndex = 0;
  }

  #emitColumn(value: string, quoted: boolean) {
    const index = this.#colIndex++;
    if (this.#inHeaderRow) {
      this.#headers.push(value);
      this.#handler.onColumn?.(new ColumnEvent(value, { index, quoted }));
    }
    else {
      const header = this.#headerEmitted ? this.#headers[index] : undefined;
      this.#handler.onColumn?.(new ColumnEvent(value, { index, header, quoted }));
    }
  }

  #endRow() {
    if (this.#inHeaderRow) {
      this.#headerEmitted = true;
      this.#handler.onEndHeaderRow?.(new EndHeaderRowEvent());
    }
    else {
      this.#handler.onEndRecordRow?.(new EndRecordRowEvent());
      this.#rowIndex++;
    }
    this.#inRow = false;
    this.#inHeaderRow = false;
  }

  #rowStart(ch: Ch) {
    if (ch === EOL) return;
    if (ch === "\r") {
      if (!this.#skipEmptyLines) {
        this.#startRow();
        this.#emitColumn("", false);
        this.#endRow();
      }
      this.#setState(this.#consumeLF, "#consumeLF");
      return;
    }
    if (ch === "\n") {
      if (!this.#skipEmptyLines) {
        this.#startRow();
        this.#emitColumn("", false);
        this.#endRow();
      }
      return;
    }
    this.#startRow();
    this.#setState(this.#fieldStart, "#fieldStart");
    this.#fieldStart(ch);
  }

  #consumeLF(ch: Ch) {
    if (ch === EOL) return;
    this.#setState(this.#rowStart, "#rowStart");
    if (ch === "\n") return;
    this.#rowStart(ch);
  }

  #fieldStart(ch: Ch) {
    if (ch === EOL) {
      if (this.#inRow) {
        this.#emitColumn("", false);
        this.#endRow();
      }
      return;
    }
    if (ch === this.#quote) {
      this.#acc = "";
      this.#setState(this.#inQuotedField, "#inQuotedField");
      return;
    }
    if (ch === this.#delimiter) {
      this.#emitColumn("", false);
      return;
    }
    if (ch === "\r") {
      this.#emitColumn("", false);
      this.#endRow();
      this.#setState(this.#consumeLF, "#consumeLF");
      return;
    }
    if (ch === "\n") {
      this.#emitColumn("", false);
      this.#endRow();
      this.#setState(this.#rowStart, "#rowStart");
      return;
    }
    this.#acc = ch;
    this.#setState(this.#inUnquotedField, "#inUnquotedField");
  }

  #inUnquotedField(ch: Ch) {
    if (ch === EOL) {
      this.#emitColumn(this.#acc, false);
      this.#acc = "";
      this.#endRow();
      return;
    }
    if (ch === this.#delimiter) {
      this.#emitColumn(this.#acc, false);
      this.#acc = "";
      this.#setState(this.#fieldStart, "#fieldStart");
      return;
    }
    if (ch === "\r") {
      this.#emitColumn(this.#acc, false);
      this.#acc = "";
      this.#endRow();
      this.#setState(this.#consumeLF, "#consumeLF");
      return;
    }
    if (ch === "\n") {
      this.#emitColumn(this.#acc, false);
      this.#acc = "";
      this.#endRow();
      this.#setState(this.#rowStart, "#rowStart");
      return;
    }
    if (ch === this.#quote) {
      this.#reportError(this.#makeError(`Unexpected quote in unquoted field at pos ${this.#pos}`));
    }
    this.#acc += ch;
  }

  #inQuotedField(ch: Ch) {
    if (ch === EOL) {
      this.#reportError(this.#makeError("Unexpected end of input inside quoted field"));
    }
    if (ch === this.#quote) {
      this.#setState(this.#inQuotedFieldQuote, "#inQuotedFieldQuote");
      return;
    }
    this.#acc += ch;
  }

  #inQuotedFieldQuote(ch: Ch) {
    if (ch === EOL) {
      this.#emitColumn(this.#acc, true);
      this.#acc = "";
      this.#endRow();
      return;
    }
    if (ch === this.#quote) {
      this.#acc += this.#quote;
      this.#setState(this.#inQuotedField, "#inQuotedField");
      return;
    }
    if (ch === this.#delimiter) {
      this.#emitColumn(this.#acc, true);
      this.#acc = "";
      this.#setState(this.#fieldStart, "#fieldStart");
      return;
    }
    if (ch === "\r") {
      this.#emitColumn(this.#acc, true);
      this.#acc = "";
      this.#endRow();
      this.#setState(this.#consumeLF, "#consumeLF");
      return;
    }
    if (ch === "\n") {
      this.#emitColumn(this.#acc, true);
      this.#acc = "";
      this.#endRow();
      this.#setState(this.#rowStart, "#rowStart");
      return;
    }
    this.#reportError(this.#makeError(`Unexpected character ${JSON.stringify(ch)} after closing quote at pos ${this.#pos}`));
  }

  enqueue(chunk: string): void {
    if (this.#flushed) {
      this.#reportError(this.#makeError("Cannot enqueue after flush()"));
    }
    if (chunk.length === 0) return;

    this.#buffer += chunk;

    if (!this.#bomChecked) {
      this.#bomChecked = true;
      if (this.#stripBom && this.#buffer[0] === "\uFEFF") {
        this.#pos++;
      }
    }

    this.#ensureDocumentStarted();

    this.#handler.onParseBefore?.(this.#status());
    try {
      while (this.#pos < this.#buffer.length) {
        this.#handler.onParseLoopBefore?.(this.#status());
        const ch = this.#buffer[this.#pos++];
        this.#state(ch);
        this.#handler.onParseLoopAfter?.(this.#status());
      }
    }
    catch (err) {
      this.#reportError(err);
    }
    this.#handler.onParseAfter?.(this.#status());

    // Compact processed buffer
    if (this.#pos > 0) {
      this.#buffer = this.#buffer.slice(this.#pos);
      this.#pos = 0;
    }
  }

  flush(): void {
    if (this.#flushed) return;
    this.#flushed = true;
    this.#bomChecked = true;
    this.#ensureDocumentStarted();

    this.#handler.onParseBefore?.(this.#status());
    try {
      this.#state(EOL);
    }
    catch (err) {
      this.#reportError(err);
    }
    this.#handler.onParseAfter?.(this.#status());

    if (!this.#skipDocument) {
      this.#handler.onEndDocument?.(new EndDocumentEvent());
    }
  }
}
