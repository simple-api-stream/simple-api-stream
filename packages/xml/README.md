# @simple-api-stream/xml

Streaming XML (SAX = Simple API for XML) parser and serializer built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/xml
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Class | Stream type | Input | Output |
|-------|-------------|-------|--------|
| [`XMLTextToSAXTransformStream`](./src/XMLTextToSAXTransformStream.ts) | `TransformStream` | XML text (`string` chunks) | [`SAXEventInterface`](./src/event-interface/SAXEventInterface.ts) objects |
| [`XMLTextToSAXEventWritableStream`](./src/XMLTextToSAXEventWritableStream.ts) | `WritableStream` | XML text (`string` chunks) | Calls a [`SAXHandler`](./src/interface/SAXHandler.ts) |
| [`SAXToObjectTransformStream<T>`](./src/SAXToObjectTransformStream.ts) | `TransformStream` | SAX events | Lightweight plain-object XML AST (`XMLDocumentNode`) or mapped `T` |
| [`ObjectToSAXTransformStream<T>`](./src/ObjectToSAXTransformStream.ts) | `TransformStream` | Lightweight XML AST (`XMLNode`) or mapped `T` | SAX events |
| [`SAXToDOMTransformStream<T>`](./src/SAXToDOMTransformStream.ts) | `TransformStream` | SAX events | DOM `Document` or `DocumentFragment` |
| [`DOMToSAXTransformStream`](./src/DOMToSAXTransformStream.ts) | `TransformStream` | DOM-like nodes (`DOMNodeLike`) | SAX events |
| [`SAXToXMLTextTransformStream`](./src/SAXToXMLTextTransformStream.ts) | `TransformStream` | SAX events | XML text |
| [`ResolveToSAXReadableStream`](./src/ResolveToSAXReadableStream.ts) | `ReadableStream` | Method calls ([`SAXResolver`](./src/interface/SAXResolver.ts)) | SAX events |

## Usage

```ts
import { XMLTextToSAXTransformStream } from "@simple-api-stream/xml";

const events = xmlTextStream.pipeThrough(new XMLTextToSAXTransformStream());

for await (const event of events) {
  if (event.name === "startElement")
    console.log(event.tagName, event.attrs);
}
```

## SAX Events

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

For full options, error classes, and usage examples, see the [root README](../../README.md).

## License

[MIT](./LICENSE)
