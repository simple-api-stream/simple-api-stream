# @simple-api-stream/json

Streaming JSON (SAJ = Simple API for JSON) parser and serializer built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/json
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Class | Stream type | Input | Output |
|-------|-------------|-------|--------|
| [`JSONTextToSAJTransformStream`](./src/JSONTextToSAJTransformStream.ts) | `TransformStream` | JSON text (`string` chunks) | [`SAJEventInterface`](./src/event-interface/SAJEventInterface.ts) objects |
| [`JSONTextToSAJEventWritableStream`](./src/JSONTextToSAJEventWritableStream.ts) | `WritableStream` | JSON text (`string` chunks) | Calls a [`SAJHandler`](./src/interface/SAJHandler.ts) |
| [`SAJToObjectTransformStream<T>`](./src/SAJToObjectTransformStream.ts) | `TransformStream` | SAJ events | JavaScript values of type `T` |
| [`ObjectToSAJTransformStream<T>`](./src/ObjectToSAJTransformStream.ts) | `TransformStream` | JavaScript values (incl. `toJSON()`, iterables, async iterables) | SAJ events |
| [`SAJToJSONTextTransformStream`](./src/SAJToJSONTextTransformStream.ts) | `TransformStream` | SAJ events | JSON text |
| [`ResolveToSAJReadableStream`](./src/ResolveToSAJReadableStream.ts) | `ReadableStream` | Method calls ([`SAJResolver`](./src/interface/SAJResolver.ts)) | SAJ events |

## Usage

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

## SAJ Events

| `name` | Extra fields |
|--------|--------------|
| `startDocument` | `kind: "json"` |
| `endDocument` | – |
| `error` | `error: unknown` (emitted when `multiple: "json-seq"` and `errorToEvent: true`) |
| `startObject` / `endObject` | – |
| `startArray` / `endArray` | – |
| `key` | `key: string` |
| `value` | `type: "string" \| "number" \| "boolean" \| "null"`, `value` |
| `comment` | `comment: string`, `style?: "line" \| "block"` (emitted when `allowComments: true`) |

For full options, error classes, and usage examples, see the [root README](../../README.md).

## See Also

- [RFC 8259 — The JavaScript Object Notation (JSON) Data Interchange Format](https://datatracker.ietf.org/doc/html/rfc8259)
- [RFC 7464 — JavaScript Object Notation (JSON) Text Sequences (`application/json-seq`)](https://datatracker.ietf.org/doc/html/rfc7464)
- [RFC 8142 — GeoJSON Text Sequences (`application/geo+json-seq`)](https://datatracker.ietf.org/doc/html/rfc8142)
- [JSON Lines](https://jsonlines.org/) / [NDJSON Specification](https://github.com/ndjson/ndjson-spec)
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)

## License

[MIT](./LICENSE)
