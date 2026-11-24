# @simple-api-stream/csv

Streaming CSV (SAC = Simple API for CSV) parser and serializer built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/csv
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Class | Stream type | Input | Output |
|-------|-------------|-------|--------|
| [`CSVTextToSACTransformStream`](./src/CSVTextToSACTransformStream.ts) | `TransformStream` | CSV text (`string` chunks) | [`SACEventInterface`](./src/event-interface/SACEventInterface.ts) objects |
| [`CSVTextToSACEventWritableStream`](./src/CSVTextToSACEventWritableStream.ts) | `WritableStream` | CSV text (`string` chunks) | Calls a [`SACHandler`](./src/interface/SACHandler.ts) |
| [`SACToObjectTransformStream<T>`](./src/SACToObjectTransformStream.ts) | `TransformStream` | SAC events | JavaScript row objects / values of type `T` |
| [`ObjectToSACTransformStream<T>`](./src/ObjectToSACTransformStream.ts) | `TransformStream` | JavaScript row objects / iterables | SAC events |
| [`SACToCSVTextTransformStream`](./src/SACToCSVTextTransformStream.ts) | `TransformStream` | SAC events | CSV text |
| [`ResolveToSACReadableStream`](./src/ResolveToSACReadableStream.ts) | `ReadableStream` | Method calls ([`SACResolver`](./src/interface/SACResolver.ts)) | SAC events |
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
