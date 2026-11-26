# @simple-api-stream/xml

Streaming XML (SAX = Simple API for XML) parser, AST/DOM converters, serializer, and optional JSON (SAJ) bridge built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/xml
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Export | Type | Input | Output |
|--------|------|-------|--------|
| [`XMLTextToSAXTransformStream`](./src/XMLTextToSAXTransformStream.ts) | `TransformStream` | XML text (`string` chunks) | [`SAXEventInterface`](./src/event-interface/SAXEventInterface.ts) objects |
| [`XMLTextToSAXEventWritableStream`](./src/XMLTextToSAXEventWritableStream.ts) | `WritableStream` | XML text (`string` chunks) | Calls a [`SAXHandler`](./src/interface/SAXHandler.ts) |
| [`SAXToObjectTransformStream<T>`](./src/SAXToObjectTransformStream.ts) | `TransformStream` | SAX events | Lightweight plain-object XML AST (`XMLDocumentNode`) or mapped `T` |
| [`ObjectToSAXTransformStream<T>`](./src/ObjectToSAXTransformStream.ts) | `TransformStream` | Lightweight XML AST (`XMLNode`) or mapped `T` | SAX events |
| [`SAXToDOMTransformStream<T>`](./src/SAXToDOMTransformStream.ts) | `TransformStream` | SAX events | DOM `Document` or `DocumentFragment` |
| [`DOMToSAXTransformStream`](./src/DOMToSAXTransformStream.ts) | `TransformStream` | DOM-like nodes (`DOMNodeLike`) | SAX events |
| [`SAXToXMLTextTransformStream`](./src/SAXToXMLTextTransformStream.ts) | `TransformStream` | SAX events | XML text |
| [`ResolveToSAXReadableStream`](./src/ResolveToSAXReadableStream.ts) | `ReadableStream` | Method calls ([`SAXResolver`](./src/interface/SAXResolver.ts)) | SAX events |
| [`parseXMLResponse<T>`](./src/parseXMLResponse.ts) | Helper function | Fetch `Response` | `ReadableStream<T>` (`XMLDocumentNode` or mapped `T`) |
| [`SAXToSAJTransformStream`](./src/json/SAXToSAJTransformStream.ts) (`@simple-api-stream/xml/json`) | `TransformStream` | SAX events | SAJ events (lossless `XMLDocumentNode` AST JSON, O(depth) streaming) |
| [`SAJToSAXTransformStream`](./src/json/SAJToSAXTransformStream.ts) (`@simple-api-stream/xml/json`) | `TransformStream` | SAJ events (`XMLNode` AST JSON) | SAX events |

## Usage

```ts
import { XMLTextToSAXTransformStream } from "@simple-api-stream/xml";

const events = xmlTextStream.pipeThrough(new XMLTextToSAXTransformStream());

for await (const event of events) {
  if (event.name === "startElement")
    console.log(event.tagName, event.attrs);
}
```

### Converting XML to JSON (`@simple-api-stream/xml/json`)

```ts
import { XMLTextToSAXTransformStream } from "@simple-api-stream/xml";
import { SAXToSAJTransformStream } from "@simple-api-stream/xml/json";
import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";

const jsonText = xmlTextStream
  .pipeThrough(new XMLTextToSAXTransformStream())
  .pipeThrough(new SAXToSAJTransformStream())
  .pipeThrough(new SAJToJSONTextTransformStream({ indent: 2 }));
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

## See Also

- [W3C Extensible Markup Language (XML) 1.0 (Fifth Edition)](https://www.w3.org/TR/xml/)
- [W3C Associating Style Sheets with XML documents (`<?xml-stylesheet ...?>`)](https://www.w3.org/TR/xml-stylesheet/)
- [WHATWG HTML Living Standard — Named Character References](https://html.spec.whatwg.org/multipage/named-characters.html)
- [WHATWG DOM Standard](https://dom.spec.whatwg.org/)
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)

## License

[MIT](./LICENSE)
