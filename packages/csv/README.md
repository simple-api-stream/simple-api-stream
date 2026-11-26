# @simple-api-stream/csv

Streaming CSV (SAC = Simple API for CSV) parser, row object converters, serializer, and optional JSON (SAJ) bridge built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/csv
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Export | Type | Input | Output |
|--------|------|-------|--------|
| [`CSVTextToSACTransformStream`](./src/CSVTextToSACTransformStream.ts) | `TransformStream` | CSV text (`string` chunks) | [`SACEventInterface`](./src/event-interface/SACEventInterface.ts) objects |
| [`CSVTextToSACEventWritableStream`](./src/CSVTextToSACEventWritableStream.ts) | `WritableStream` | CSV text (`string` chunks) | Calls a [`SACHandler`](./src/interface/SACHandler.ts) |
| [`SACToObjectTransformStream<T>`](./src/SACToObjectTransformStream.ts) | `TransformStream` | SAC events | JavaScript row objects / values of type `T` |
| [`ObjectToSACTransformStream<T>`](./src/ObjectToSACTransformStream.ts) | `TransformStream` | JavaScript row objects / iterables | SAC events |
| [`SACToCSVTextTransformStream`](./src/SACToCSVTextTransformStream.ts) | `TransformStream` | SAC events | CSV text |
| [`ResolveToSACReadableStream`](./src/ResolveToSACReadableStream.ts) | `ReadableStream` | Method calls ([`SACResolver`](./src/interface/SACResolver.ts)) | SAC events |
| [`parseCSVResponse<T>`](./src/parseCSVResponse.ts) | Helper function | Fetch `Response` | `ReadableStream<T>` (auto-sets `delimiter: "\t"` for TSV) |
| [`SACToSAJTransformStream`](./src/json/SACToSAJTransformStream.ts) (`@simple-api-stream/csv/json`) | `TransformStream` | SAC events | SAJ events (O(1) streaming JSON array / NDJSON) |
| [`SAJToSACTransformStream`](./src/json/SAJToSACTransformStream.ts) (`@simple-api-stream/csv/json`) | `TransformStream` | SAJ events (JSON array of rows / NDJSON) | SAC events |

## Usage

```ts
import { CSVTextToSACTransformStream } from "@simple-api-stream/csv";

const events = csvTextStream.pipeThrough(new CSVTextToSACTransformStream({ header: true }));

for await (const event of events) {
  if (event.name === "column")
    console.log(event.index, event.header, event.value);
}
```

### Converting CSV to JSON (`@simple-api-stream/csv/json`)

```ts
import { CSVTextToSACTransformStream } from "@simple-api-stream/csv";
import { SACToSAJTransformStream } from "@simple-api-stream/csv/json";
import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";

const jsonText = csvTextStream
  .pipeThrough(new CSVTextToSACTransformStream({ header: true }))
  .pipeThrough(new SACToSAJTransformStream())
  .pipeThrough(new SAJToJSONTextTransformStream({ indent: 2 }));
```

## SAC Events

| `name` | Extra fields |
|--------|--------------|
| `startDocument` | `kind: "csv"` |
| `endDocument` | – |
| `startHeaderRow` / `endHeaderRow` | – |
| `startRecordRow` / `endRecordRow` | – |
| `column` | `value: string`, `index?: number`, `header?: string`, `quoted?: boolean` |

For full options, error classes, and usage examples, see the [root README](../../README.md).

## See Also

- [RFC 4180 — Common Format and MIME Type for Comma-Separated Values (CSV) Files](https://datatracker.ietf.org/doc/html/rfc4180)
- [IANA `text/tab-separated-values` Media Type](https://www.iana.org/assignments/media-types/text/tab-separated-values)
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)

## License

[MIT](./LICENSE)
