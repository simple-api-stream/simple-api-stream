# @simple-api-stream/ini

Streaming INI (**SAI**: Simple API for INI) parser, serializer, object converters, imperative builder, Fetch `Response` helper, and optional TOML (`./toml`) and JSON (`./json`) bridges built on the Web Streams API.

## Installation

```bash
npm install @simple-api-stream/ini
```

## Quick Start

```ts
import {
  INITextToSAITransformStream,
  SAIToObjectTransformStream,
} from "@simple-api-stream/ini";

const objects = iniTextStream
  .pipeThrough(new INITextToSAITransformStream())
  .pipeThrough(new SAIToObjectTransformStream());
```

### Streaming INI ⇔ TOML Conversion

```ts
import { INITextToSAITransformStream } from "@simple-api-stream/ini";
import { SAIToSATTransformStream } from "@simple-api-stream/ini/toml";
import { SATToTOMLTextTransformStream } from "@simple-api-stream/toml";

const tomlText = iniTextStream
  .pipeThrough(new INITextToSAITransformStream({ comments: true }))
  .pipeThrough(new SAIToSATTransformStream())
  .pipeThrough(new SATToTOMLTextTransformStream({ comments: true }));
```

## License

[MIT](./LICENSE)
