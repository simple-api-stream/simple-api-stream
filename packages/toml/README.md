# @simple-api-stream/toml

Streaming TOML (SAT = Simple API for TOML) parser, object materializer, serializer, and optional JSON (SAJ) bridge built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/toml
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Export | Type | Input | Output |
|--------|------|-------|--------|
| [`TOMLTextToSATTransformStream`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/TOMLTextToSATTransformStream.ts) | `TransformStream` | TOML text (`string` chunks) | [`SATEventInterface`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/event-interface/SATEventInterface.ts) objects |
| [`TOMLTextToSATEventWritableStream`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/TOMLTextToSATEventWritableStream.ts) | `WritableStream` | TOML text (`string` chunks) | Calls a [`SATHandler`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/interface/SATHandler.ts) |
| [`SATToObjectTransformStream<T>`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/SATToObjectTransformStream.ts) | `TransformStream` | SAT events | JavaScript objects of type `T` |
| [`ObjectToSATTransformStream<T>`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/ObjectToSATTransformStream.ts) | `TransformStream` | JavaScript table objects | SAT events |
| [`SATToTOMLTextTransformStream`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/SATToTOMLTextTransformStream.ts) | `TransformStream` | SAT events | TOML text |
| [`ResolveToSATReadableStream`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/ResolveToSATReadableStream.ts) | `ReadableStream` | Method calls ([`SATResolver`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/interface/SATResolver.ts)) | SAT events |
| [`parseTOMLResponse<T>`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/parseTOMLResponse.ts) | Helper function | Fetch `Response` | `ReadableStream<T>` (reconstructed TOML table objects) |
| [`SATToSAJTransformStream`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/json/SATToSAJTransformStream.ts) (`@simple-api-stream/toml/json`) | `TransformStream` | SAT events | SAJ events (`@simple-api-stream/json` optional peer) |
| [`SAJToSATTransformStream`](https://github.com/simple-api-stream/simple-api-stream/blob/main/packages/toml/src/json/SAJToSATTransformStream.ts) (`@simple-api-stream/toml/json`) | `TransformStream` | SAJ events | SAT events (`@simple-api-stream/json` optional peer) |

## Usage

```ts
import {
  TOMLTextToSATTransformStream,
  SATToObjectTransformStream,
} from "@simple-api-stream/toml";

const objects = tomlTextStream
  .pipeThrough(new TOMLTextToSATTransformStream())
  .pipeThrough(new SATToObjectTransformStream());

for await (const obj of objects) {
  console.log("Parsed TOML:", obj);
}
```

### Converting TOML to JSON (`@simple-api-stream/toml/json`)

```ts
import { TOMLTextToSATTransformStream } from "@simple-api-stream/toml";
import { SATToSAJTransformStream } from "@simple-api-stream/toml/json";
import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";

const jsonText = tomlTextStream
  .pipeThrough(new TOMLTextToSATTransformStream())
  .pipeThrough(new SATToSAJTransformStream())
  .pipeThrough(new SAJToJSONTextTransformStream({ indent: 2 }));
```

## SAT Events

| `name` | Extra fields |
|--------|--------------|
| `startDocument` | `kind: "toml"` |
| `endDocument` | – |
| `comment` | `comment: string` (emitted when `comments: true`) |
| `table` | `path: string[]` (`[a.b]`) |
| `arrayTable` | `path: string[]` (`[[a.b]]`) |
| `key` | `path: string[]` (`a.b = ...`) |
| `startArray` / `endArray` | – |
| `startInlineTable` / `endInlineTable` | – |
| `value` | `type: "string" \| "integer" \| "float" \| "boolean" \| "offsetDateTime" \| "localDateTime" \| "localDate" \| "localTime"`, `value` |

For full options, error classes, and usage examples, see the [root README](https://github.com/simple-api-stream/simple-api-stream#readme).

## See Also

- [TOML v1.0.0 Specification](https://toml.io/en/v1.0.0)
- [RFC 3339 — Date and Time on the Internet: Timestamps](https://datatracker.ietf.org/doc/html/rfc3339)
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)

## License

[MIT](./LICENSE)
