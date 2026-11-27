# @simple-api-stream/ini

Streaming INI (SAI = Simple API for INI) parser, object materializer, serializer, and optional TOML (SAT) and JSON (SAJ) bridges built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/ini
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Export | Type | Input | Output |
|--------|------|-------|--------|
| [`INITextToSAITransformStream`](./src/INITextToSAITransformStream.ts) | `TransformStream` | INI text (`string` chunks) | [`SAIEventInterface`](./src/event-interface/SAIEventInterface.ts) objects |
| [`INITextToSAIEventWritableStream`](./src/INITextToSAIEventWritableStream.ts) | `WritableStream` | INI text (`string` chunks) | Calls a [`SAIHandler`](./src/interface/SAIHandler.ts) |
| [`SAIToObjectTransformStream<T>`](./src/SAIToObjectTransformStream.ts) | `TransformStream` | SAI events | JavaScript objects of type `T` |
| [`ObjectToSAITransformStream<T>`](./src/ObjectToSAITransformStream.ts) | `TransformStream` | JavaScript plain objects | SAI events |
| [`SAIToINITextTransformStream`](./src/SAIToINITextTransformStream.ts) | `TransformStream` | SAI events | INI text |
| [`ResolveToSAIReadableStream`](./src/ResolveToSAIReadableStream.ts) | `ReadableStream` | Method calls ([`SAIResolver`](./src/interface/SAIResolver.ts)) | SAI events |
| [`parseINIResponse<T>`](./src/parseINIResponse.ts) | Helper function | Fetch `Response` | `ReadableStream<T>` (reconstructed INI objects) |
| [`SAIToSATTransformStream`](./src/toml/SAIToSATTransformStream.ts) (`@simple-api-stream/ini/toml`) | `TransformStream` | SAI events | SAT events (`@simple-api-stream/toml` optional peer) |
| [`SATToSAITransformStream`](./src/toml/SATToSAITransformStream.ts) (`@simple-api-stream/ini/toml`) | `TransformStream` | SAT events | SAI events (`@simple-api-stream/toml` optional peer) |
| [`SAIToSAJTransformStream`](./src/json/SAIToSAJTransformStream.ts) (`@simple-api-stream/ini/json`) | `TransformStream` | SAI events | SAJ events (`@simple-api-stream/json` optional peer) |
| [`SAJToSAITransformStream`](./src/json/SAJToSAITransformStream.ts) (`@simple-api-stream/ini/json`) | `TransformStream` | SAJ events | SAI events (`@simple-api-stream/json` optional peer) |

## Usage

```ts
import {
  INITextToSAITransformStream,
  SAIToObjectTransformStream,
} from "@simple-api-stream/ini";

const objects = iniTextStream
  .pipeThrough(new INITextToSAITransformStream())
  .pipeThrough(new SAIToObjectTransformStream());

for await (const obj of objects) {
  console.log("Parsed INI:", obj);
}
```

### Converting INI to TOML (`@simple-api-stream/ini/toml`)

```ts
import { INITextToSAITransformStream } from "@simple-api-stream/ini";
import { SAIToSATTransformStream } from "@simple-api-stream/ini/toml";
import { SATToTOMLTextTransformStream } from "@simple-api-stream/toml";

const tomlText = iniTextStream
  .pipeThrough(new INITextToSAITransformStream({ comments: true }))
  .pipeThrough(new SAIToSATTransformStream())
  .pipeThrough(new SATToTOMLTextTransformStream({ comments: true }));
```

### Converting INI to JSON (`@simple-api-stream/ini/json`)

```ts
import { INITextToSAITransformStream } from "@simple-api-stream/ini";
import { SAIToSAJTransformStream } from "@simple-api-stream/ini/json";
import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";

const jsonText = iniTextStream
  .pipeThrough(new INITextToSAITransformStream())
  .pipeThrough(new SAIToSAJTransformStream())
  .pipeThrough(new SAJToJSONTextTransformStream({ indent: 2 }));
```

## SAI Events

| `name` | Extra fields |
|--------|--------------|
| `startDocument` | `kind: "ini"` |
| `endDocument` | – |
| `comment` | `comment: string`, `prefix?: string` (emitted when `comments: true`) |
| `section` | `section: string` (`[section]`) |
| `entry` | `key: string`, `value: string` (`key = value`) |

For full options, error classes, and usage examples, see the [root README](../../README.md).

## See Also

- [INI file — Wikipedia](https://en.wikipedia.org/wiki/INI_file)
- [TOML v1.0.0 Specification](https://toml.io/en/v1.0.0)
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)

## License

[MIT](./LICENSE)
