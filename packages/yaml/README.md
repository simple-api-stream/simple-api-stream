# @simple-api-stream/yaml

Streaming YAML 1.2 (SAY = Simple API for YAML) parser, object materializer, serializer, and optional JSON (SAJ) bridge built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/yaml
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Export | Type | Input | Output |
|--------|------|-------|--------|
| [`YAMLTextToSAYTransformStream`](./src/YAMLTextToSAYTransformStream.ts) | `TransformStream` | YAML text (`string` chunks) | [`SAYEventInterface`](./src/event-interface/SAYEventInterface.ts) objects |
| [`YAMLTextToSAYEventWritableStream`](./src/YAMLTextToSAYEventWritableStream.ts) | `WritableStream` | YAML text (`string` chunks) | Calls a [`SAYHandler`](./src/interface/SAYHandler.ts) |
| [`SAYToObjectTransformStream<T>`](./src/SAYToObjectTransformStream.ts) | `TransformStream` | SAY events | JavaScript values of type `T` |
| [`ObjectToSAYTransformStream<T>`](./src/ObjectToSAYTransformStream.ts) | `TransformStream` | JavaScript values | SAY events |
| [`SAYToYAMLTextTransformStream`](./src/SAYToYAMLTextTransformStream.ts) | `TransformStream` | SAY events | YAML text |
| [`ResolveToSAYReadableStream`](./src/ResolveToSAYReadableStream.ts) | `ReadableStream` | Method calls ([`SAYResolver`](./src/interface/SAYResolver.ts)) | SAY events |
| [`parseYAMLResponse<T>`](./src/parseYAMLResponse.ts) | Helper function | Fetch `Response` | `ReadableStream<T>` (reconstructed YAML values) |
| [`SAYToSAJTransformStream`](./src/json/SAYToSAJTransformStream.ts) (`@simple-api-stream/yaml/json`) | `TransformStream` | SAY events | SAJ events (`@simple-api-stream/json` optional peer) |
| [`SAJToSAYTransformStream`](./src/json/SAJToSAYTransformStream.ts) (`@simple-api-stream/yaml/json`) | `TransformStream` | SAJ events | SAY events (`@simple-api-stream/json` optional peer) |

## Usage

```ts
import { parseYAMLResponse } from "@simple-api-stream/yaml";

const response = await fetch("https://example.com/config.yaml");
for await (const doc of parseYAMLResponse(response)) {
  console.log("Parsed YAML:", doc);
}
```

Or compose the underlying Web Streams directly:

```ts
import {
  YAMLTextToSAYTransformStream,
  SAYToObjectTransformStream,
} from "@simple-api-stream/yaml";

const docs = yamlTextStream
  .pipeThrough(new YAMLTextToSAYTransformStream())
  .pipeThrough(new SAYToObjectTransformStream());

for await (const doc of docs) {
  console.log("Parsed YAML:", doc);
}
```

### Converting YAML to JSON (`@simple-api-stream/yaml/json`)

```ts
import { YAMLTextToSAYTransformStream } from "@simple-api-stream/yaml";
import { SAYToSAJTransformStream } from "@simple-api-stream/yaml/json";
import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";

const jsonText = yamlTextStream
  .pipeThrough(new YAMLTextToSAYTransformStream())
  .pipeThrough(new SAYToSAJTransformStream())
  .pipeThrough(new SAJToJSONTextTransformStream({ indent: 2 }));
```

## SAY Events

| `name` | Extra fields |
|--------|--------------|
| `startDocument` | `kind: "yaml"` |
| `endDocument` | – |
| `comment` | `comment: string` (emitted when `comments: true`) |
| `startMapping` / `endMapping` | `flow?: boolean`, `anchor?: string`, `tag?: string` |
| `startSequence` / `endSequence` | `flow?: boolean`, `anchor?: string`, `tag?: string` |
| `key` | `key: string` |
| `scalar` | `type: "string" \| "number" \| "boolean" \| "null"`, `value`, `style?: "plain" \| "single" \| "double" \| "literal" \| "folded"`, `anchor?: string`, `tag?: string` |
| `alias` | `alias: string` |

For full options, error classes, and usage examples, see the [root README](../../README.md).

## See Also

- [YAML 1.2.2 Specification](https://yaml.org/spec/1.2.2/)
- [YAML 1.2 Core Schema](https://yaml.org/spec/1.2.2/#103-core-schema)
- [RFC 9512 — The `application/yaml` Media Type](https://datatracker.ietf.org/doc/html/rfc9512)
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)

## License

[MIT](./LICENSE)
