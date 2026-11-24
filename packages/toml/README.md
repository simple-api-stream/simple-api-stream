# `@simple-api-stream/toml`

Streaming TOML (SAT: Simple API for TOML) parser, serializer, and Web Streams utilities, plus an optional JSON bridge (`@simple-api-stream/toml/json`).

## Features

- `TOMLTextToSATTransformStream` — Parses TOML text chunks into SAT events (`table`, `arrayTable`, `key`, `startArray`, `endArray`, `startInlineTable`, `endInlineTable`, `value`, `comment`, `startDocument`, `endDocument`).
- `TOMLTextToSATEventWritableStream` — Invokes `SATHandler` callbacks as TOML text chunks are written.
- `SATToTOMLTextTransformStream` — Serializes SAT events back into TOML text.
- `SATToObjectTransformStream` — Reconstructs JavaScript objects from SAT events.
- `ResolveToSATReadableStream` — Programmatically emits SAT events via `SATResolver`.
- `@simple-api-stream/toml/json` (`SATToSAJTransformStream`) — Converts SAT events to SAJ events for `@simple-api-stream/json` (`@simple-api-stream/json` is an optional peer dependency).
