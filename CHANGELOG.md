# Changelog

All notable changes to this project will be documented in this file.  
Adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and uses [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Added
- _No unreleased changes at this time._

## [1.0.0] - 2026-11-19
### Added
- Initial release of **simple-api-stream** package (ESM-only build targeting Node.js `>= 24`, also directly `require()`-able via `require(esm)`), with TypeScript declarations and zero runtime dependencies.
- Subpath exports: `simple-api-stream`, `simple-api-stream/json`, and `simple-api-stream/xml`.
- Streaming JSON utilities (SAJ: Simple API for JSON):
  - `JSONTextToSAJEventWritableStream` — Executes SAJ events on a custom handler (`skipDocument`, `multiple`, and parse debug hooks).
  - `JSONTextToSAJTransformStream` — Emits typed SAJ event objects from JSON text (`skipDocument`, `multiple`, and parse debug hooks).
  - `ResolveToSAJReadableStream` — Programmatically resolves SAJ events (with `Symbol.dispose` support).
  - `SAJToObjectTransformStream<T>` — Converts SAJ events into JavaScript values (`multiple`, `startDocument` / `endDocument` support).
  - `ObjectToSAJTransformStream<T>` — Converts JavaScript values (including `toJSON()`, iterators, and async iterators) into SAJ events (`makeDocument`, `unSupported` options).
  - `SAJToJSONTextTransformStream` — Serializes SAJ events back into JSON text (`summarize`, `indent`, `lineBreak` options, incomplete structure validation on flush).
- Streaming XML utilities (SAX: Simple API for XML):
  - `XMLTextToSAXEventWritableStream` — Executes SAX events on a custom handler (`skipDocument` option).
  - `XMLTextToSAXTransformStream` — Emits typed SAX event objects from XML text (`skipDocument` option).
  - `ResolveToSAXReadableStream` — Programmatically resolves SAX events (with `Symbol.dispose` support).
  - `SAXToXMLTextTransformStream` — Converts SAX events back to XML text (`indent`, `lineBreak`, `summarize` options).
- Documentation:
  - Architecture overview, feature matrix, usage examples, option tables, event format references, error classes, and subpath export guide in `README.md`.

[Unreleased]: https://github.com/juner/simple-api-stream/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/juner/simple-api-stream/releases/tag/v1.0.0
