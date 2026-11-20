# simple-api-stream

Streaming utilities for **incremental JSON and XML processing** built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

Text is parsed chunk by chunk into a flat sequence of **events**: SAJ (Simple API for JSON) for JSON and SAX (Simple API for XML) for XML. You can consume the events directly, rebuild JavaScript objects from them, or turn them back into text. Because every component is a standard `ReadableStream` / `WritableStream` / `TransformStream`, the pieces compose with `pipeThrough()` / `pipeTo()` and respect backpressure.

- Zero external runtime dependencies
- Works anywhere Web Streams are available (Node.js, browsers, Deno, Bun, …)
- Ships ESM builds (directly `require()`-able in Node.js >= 24) with TypeScript type definitions
- Modular npm workspaces monorepo: install only the format packages you need

---

## 📦 Packages

| Package | Description |
|---------|-------------|
| [`@simple-api-stream/core`](./packages/core) | Core event classes (`SAEvent`, `StartDocumentEvent`, `EndDocumentEvent`), parser interfaces (`SimpleApiParser`), and shared utilities |
| [`@simple-api-stream/json`](./packages/json) | Streaming JSON (SAJ) parser, object materializer, serializer, and imperative builder |
| [`@simple-api-stream/xml`](./packages/xml) | Streaming XML (SAX) parser, serializer, and imperative builder |

---

## 🧭 Overview

```mermaid
flowchart LR
  subgraph JSON
    JT["JSON text"] -- JSONTextToSAJTransformStream --> SAJ["SAJ events"]
    OBJ["JS values"] -- ObjectToSAJTransformStream --> SAJ
    RJ["ResolveToSAJReadableStream (imperative)"] --> SAJ
    SAJ -- SAJToObjectTransformStream --> OBJ2["JS values"]
    SAJ -- SAJToJSONTextTransformStream --> JT2["JSON text"]
    JT -- JSONTextToSAJEventWritableStream --> HJ["SAJHandler callbacks"]
  end
  subgraph XML
    XT["XML text"] -- XMLTextToSAXTransformStream --> SAX["SAX events"]
    RX["ResolveToSAXReadableStream (imperative)"] --> SAX
    SAX -- SAXToXMLTextTransformStream --> XT2["XML text"]
    XT -- XMLTextToSAXEventWritableStream --> HX["SAXHandler callbacks"]
  end
```

## ✨ Features

| Package | Class | Stream type | Input | Output |
|---------|-------|-------------|-------|--------|
| **`@simple-api-stream/json`** | [`JSONTextToSAJTransformStream`](./packages/json/src/JSONTextToSAJTransformStream.ts) | `TransformStream` | JSON text (`string` chunks) | [`SAJEventInterface`](./packages/json/src/event-interface/SAJEventInterface.ts) objects |
| | [`JSONTextToSAJEventWritableStream`](./packages/json/src/JSONTextToSAJEventWritableStream.ts) | `WritableStream` | JSON text (`string` chunks) | Calls a [`SAJHandler`](./packages/json/src/interface/SAJHandler.ts) |
| | [`SAJToObjectTransformStream<T>`](./packages/json/src/SAJToObjectTransformStream.ts) | `TransformStream` | SAJ events | JavaScript values of type `T` |
| | [`ObjectToSAJTransformStream<T>`](./packages/json/src/ObjectToSAJTransformStream.ts) | `TransformStream` | JavaScript values (incl. iterables / async iterables) | SAJ events |
| | [`SAJToJSONTextTransformStream`](./packages/json/src/SAJToJSONTextTransformStream.ts) | `TransformStream` | SAJ events | JSON text |
| | [`ResolveToSAJReadableStream`](./packages/json/src/ResolveToSAJReadableStream.ts) | `ReadableStream` | Method calls ([`SAJResolver`](./packages/json/src/interface/SAJResolver.ts)) | SAJ events |
| **`@simple-api-stream/xml`** | [`XMLTextToSAXTransformStream`](./packages/xml/src/XMLTextToSAXTransformStream.ts) | `TransformStream` | XML text (`string` chunks) | [`SAXEventInterface`](./packages/xml/src/event-interface/SAXEventInterface.ts) objects |
| | [`XMLTextToSAXEventWritableStream`](./packages/xml/src/XMLTextToSAXEventWritableStream.ts) | `WritableStream` | XML text (`string` chunks) | Calls a [`SAXHandler`](./packages/xml/src/interface/SAXHandler.ts) |
| | [`SAXToXMLTextTransformStream`](./packages/xml/src/SAXToXMLTextTransformStream.ts) | `TransformStream` | SAX events | XML text |
| | [`ResolveToSAXReadableStream`](./packages/xml/src/ResolveToSAXReadableStream.ts) | `ReadableStream` | Method calls ([`SAXResolver`](./packages/xml/src/interface/SAXResolver.ts)) | SAX events |

---

## 🚀 Installation

```bash
# Install JSON streaming utilities
npm install @simple-api-stream/json

# Install XML streaming utilities
npm install @simple-api-stream/xml

# Install core contracts directly (optional; installed automatically by json/xml)
npm install @simple-api-stream/core
```

### Requirements

- Node.js **>= 24** (see `engines` in `package.json`), or any runtime that supports Web Streams and async iteration of `ReadableStream`.

```ts
// ESM
import { JSONTextToSAJTransformStream } from "@simple-api-stream/json";
// CommonJS
const { JSONTextToSAJTransformStream } = require("@simple-api-stream/json");
```

---

## 📦 Usage

### JSON text → JavaScript objects

```ts
import {
  JSONTextToSAJTransformStream,
  SAJToObjectTransformStream,
} from "@simple-api-stream/json";

const response = await fetch("https://example.com/data.json");

const objects = response.body!
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new JSONTextToSAJTransformStream())
  .pipeThrough(new SAJToObjectTransformStream<MyType>());

for await (const obj of objects) {
  console.log("Parsed object:", obj);
}
```

### Multiple JSON documents (e.g. JSON Lines / NDJSON)

```ts
const objects = textStream
  .pipeThrough(new JSONTextToSAJTransformStream({ multiple: true }))
  .pipeThrough(new SAJToObjectTransformStream({ multiple: true }));
```

### JSON text → handler callbacks

```ts
import { JSONTextToSAJEventWritableStream } from "@simple-api-stream/json";

await textStream.pipeTo(new JSONTextToSAJEventWritableStream({
  onKey: ({ key }) => console.log("key:", key),
  onValue: ({ type, value }) => console.log("value:", type, value),
  onError: (err) => console.error(err),
}));
```

All handler methods are optional.

### JavaScript values → SAJ events

```ts
import { ObjectToSAJTransformStream } from "@simple-api-stream/json";

const events = ReadableStream.from([{ a: [1, null] }])
  .pipeThrough(new ObjectToSAJTransformStream());
```

Arrays, plain objects, primitives, `null`, objects with `toJSON()` (such as `Date`), iterables (such as `Set` and generators), and async iterables (serialized as arrays) are supported. How unsupported values (`undefined`, `NaN`, `Infinity`, functions, `bigint`, symbols, …) are handled is controlled by the `unSupported` option.

### Building SAJ events imperatively

```ts
import { ResolveToSAJReadableStream } from "@simple-api-stream/json";

const stream = new ResolveToSAJReadableStream();
stream.startObject();
stream.key("name");
stream.value("string", "Alice");
stream.endObject();
stream.close(); // or use `using stream = new ResolveToSAJReadableStream()`

const events = await Array.fromAsync(stream);
```

### XML text → SAX events

```ts
import { XMLTextToSAXTransformStream } from "@simple-api-stream/xml";

const events = xmlTextStream.pipeThrough(new XMLTextToSAXTransformStream());

for await (const event of events) {
  if (event.name === "startElement")
    console.log(event.tagName, event.attrs);
}
```

### XML text → handler callbacks

```ts
import { XMLTextToSAXEventWritableStream } from "@simple-api-stream/xml";

await xmlTextStream.pipeTo(new XMLTextToSAXEventWritableStream({
  onStartElement: ({ tagName, attrs }) => console.log("start", tagName, attrs),
  onText: ({ text }) => console.log("text", text),
  onEndElement: ({ tagName }) => console.log("end", tagName),
  onError: (err) => console.error(err),
}));
```

### Building XML imperatively

```ts
import { ResolveToSAXReadableStream, SAXToXMLTextTransformStream } from "@simple-api-stream/xml";

const stream = new ResolveToSAXReadableStream();
const xmlText = stream.pipeThrough(new SAXToXMLTextTransformStream({ summarize: true }));

stream.startDocument();
stream.processingInstruction({ target: "xml", version: "1.0", encoding: "UTF-8" });
stream.startElement("a", { href: "https://example.com" });
stream.text("Hello & welcome");
stream.endElement("a");
stream.endDocument();
stream.close();

console.log((await Array.fromAsync(xmlText)).join(""));
// <?xml version="1.0" encoding="UTF-8" ?><a href="https://example.com">Hello &amp; welcome</a>
```

---

## ⚙️ Options

### `JSONTextToSAJTransformStream(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skipDocument` | `boolean` | `false` | Do not emit `startDocument` / `endDocument` events. |
| `multiple` | `boolean` | `false` | Accept multiple top-level JSON values in one stream. When `false`, a second value is an error. |
| `onParseBefore` / `onParseAfter` / `onParseLoopBefore` / `onParseLoopAfter` | `(status) => void` | – | Debug hooks that receive the internal parser status. |

`JSONTextToSAJEventWritableStream(handler, options?)` accepts `{ skipDocument?: boolean, multiple?: boolean }` as `options` and the same debug hooks in its `handler` object.

### `SAJToObjectTransformStream(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `multiple` | `boolean` | `false` | Accept multiple top-level values. When `false`, events after the first completed value are an error. |

### `ObjectToSAJTransformStream(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `makeDocument` | `boolean` | `true` | Wrap each written value in `startDocument` / `endDocument`. |
| `unSupported` | `"ignore" \| "error" \| "null" \| (arg: { value, skip }) => unknown` | `"ignore"` | How to handle values that cannot be represented in JSON. `"ignore"` drops them (and their key), `"error"` errors the stream, `"null"` replaces them with `null`. A function can return a replacement value or return `skip` to drop the value. |

### `SAJToJSONTextTransformStream(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `summarize` | `boolean \| "default" \| "normal" \| "document"` | `"default"` | Output granularity. `"default"` (`false`) emits one chunk per event, `"normal"` (`true`) emits one chunk per top-level JSON value, `"document"` emits one chunk per `startDocument` … `endDocument`. |
| `indent` | `number \| string` | – | Indentation per nesting level: a number of spaces or a string such as `"\t"`. |
| `lineBreak` | `string` | `"\n"` (when `indent` is set), `""` otherwise | Line break string used between lines. |

### `XMLTextToSAXTransformStream(options?)` / `XMLTextToSAXEventWritableStream(handler, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skipDocument` | `boolean` | `false` | Do not emit `startDocument` / `endDocument` events. |

### `SAXToXMLTextTransformStream(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indent` | `number \| string` | – | Indentation per nesting level: a number of spaces or a string such as `"\t"`. |
| `lineBreak` | `string` | `""` | String appended after each output block (e.g. `"\n"`). |
| `summarize` | `boolean \| "default" \| "element" \| "document"` | `"default"` | Output granularity. `"default"` (`false`) emits one chunk per event, `"element"` emits one chunk per top-level element, `"document"` (`true`) emits one chunk per `startDocument` … `endDocument`. |

Text and attribute values are escaped automatically.

---

## 📜 Event Formats

Events are plain objects with a `name` discriminator, so they can be narrowed with `switch (event.name)` in TypeScript. Type definitions are exported as `eventInterfaces` and the event classes as `events` from `@simple-api-stream/json` and `@simple-api-stream/xml`.

### SAJ (Simple API for JSON)

| `name` | Extra fields |
|--------|--------------|
| `startDocument` | `kind: "json"` |
| `endDocument` | – |
| `startObject` / `endObject` | – |
| `startArray` / `endArray` | – |
| `key` | `key: string` |
| `value` | `type: "string" \| "number" \| "boolean" \| "null"`, `value` |

Example for `{ "a": [1, null] }`:

```js
{ "name": "startDocument", "kind": "json" }
{ "name": "startObject" }
{ "name": "key", "key": "a" }
{ "name": "startArray" }
{ "name": "value", "type": "number", "value": 1 }
{ "name": "value", "type": "null", "value": null }
{ "name": "endArray" }
{ "name": "endObject" }
{ "name": "endDocument" }
```

### SAX (Simple API for XML)

| `name` | Extra fields |
|--------|--------------|
| `startDocument` | `kind: "xml"` |
| `endDocument` | – |
| `startElement` | `tagName`, `attrs: Record<string, string>`, `selfClosing: boolean` |
| `endElement` | `tagName` |
| `text` | `text` (numeric references and XML/HTML5 named entities are unescaped) |
| `cdata` | `cdata` |
| `comment` | `comment` (preserved verbatim without entity unescaping) |
| `doctype` | `root`, `dtdType?: "PUBLIC" \| "SYSTEM"`, `identifier?`, `uri?`, `declarations?: string[]` |
| `processingInstruction` | `target`, `data`; `<?xml …?>` additionally has `version`, `encoding`, `standalone`, and `<?xml-stylesheet …?>` has `type`, `href` |

Example for `<a href="https://example.com">Hello</a>`:

```js
{ "name": "startDocument", "kind": "xml" }
{ "name": "startElement", "tagName": "a", "attrs": { "href": "https://example.com" }, "selfClosing": false }
{ "name": "text", "text": "Hello" }
{ "name": "endElement", "tagName": "a" }
{ "name": "endDocument" }
```

A self-closing tag such as `<br/>` produces a `startElement` with `selfClosing: true` immediately followed by an `endElement`.

---

## ⚠️ Error Handling

- Malformed input errors the stream. With `TransformStream`s, both the readable side (e.g. `for await`) and pending writes reject.
- With the `*EventWritableStream` classes, errors are reported to the handler's `onError` callback.
- Errors carry a snapshot of the internal state for debugging (e.g. `buffer`, `state`, `pos`). The error classes are available from `streams` on `@simple-api-stream/json` and `@simple-api-stream/xml`:

| Error class | Import from |
|-------------|-------------|
| `JSONTextToSAJParserError` | `@simple-api-stream/json` (`streams.JSONTextToSAJParserError`) |
| `SAJToObjectTransformStreamError` | `@simple-api-stream/json` (`streams.SAJToObjectTransformStreamError`) |
| `ObjectToSAJTransformStreamError` | `@simple-api-stream/json` (`streams.ObjectToSAJTransformStreamError`) |
| `SAJToJSONTextTransformStreamError` | `@simple-api-stream/json` (`streams.SAJToJSONTextTransformStreamError`) |
| `XMLTextToSAXParserError` | `@simple-api-stream/xml` (`streams.XMLTextToSAXParserError`) |
| `SAXToXMLTextTransformStreamError` | `@simple-api-stream/xml` (`streams.SAXToXMLTextTransformStreamError`) |
| `ResolveToSAXReadableStreamError` | `@simple-api-stream/xml` (`streams.ResolveToSAXReadableStreamError`) |

```ts
import { JSONTextToSAJTransformStream, streams } from "@simple-api-stream/json";

try {
  for await (const event of textStream.pipeThrough(new JSONTextToSAJTransformStream())) {
    // ...
  }
}
catch (e) {
  if (e instanceof streams.JSONTextToSAJParserError)
    console.error(e.message, e.state, e.pos);
}
```

---

## 📚 Exports

```ts
// Core contracts & utilities
import {
  SAEvent,
  StartDocumentEvent,
  EndDocumentEvent,
  type SimpleApiParser,
  type StartDocumentSAEventInterface,
  type EndDocumentSAEventInterface,
} from "@simple-api-stream/core";
import { toErrorMessage, assertIsDefined, assertIsTrue } from "@simple-api-stream/core/utils";

// JSON streaming utilities
import {
  JSONTextToSAJTransformStream,
  JSONTextToSAJEventWritableStream,
  SAJToObjectTransformStream,
  ObjectToSAJTransformStream,
  SAJToJSONTextTransformStream,
  ResolveToSAJReadableStream,
  streams,
  events,
  type eventInterfaces,
  type interfaces,
} from "@simple-api-stream/json";

// XML streaming utilities
import {
  XMLTextToSAXTransformStream,
  XMLTextToSAXEventWritableStream,
  SAXToXMLTextTransformStream,
  ResolveToSAXReadableStream,
  streams,
  events,
  type eventInterfaces,
  type interfaces,
} from "@simple-api-stream/xml";
```

---

## 🛠 Development

```bash
npm install
npm run lint     # ESLint (type-aware)
npm test         # Vitest with coverage across all packages
npm run build    # Build @simple-api-stream/{core,json,xml} (ESM + .d.ts)
```

- Packages live under `packages/core`, `packages/json`, and `packages/xml`; tests are colocated as `*.test.ts`.
- Relative imports use explicit `.js` extensions (`moduleResolution: "NodeNext"`).

## 📄 License

[MIT](./LICENSE)
