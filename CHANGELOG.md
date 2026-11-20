# Changelog

All notable changes to this project will be documented in this file.  
Adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and uses [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Added
- _No unreleased changes at this time._

## [1.0.0] - 2026-11-19
### Added
- Initial release as an npm workspaces monorepo shipping ESM-only packages (targeting Node.js `>= 24`, also directly `require()`-able via `require(esm)`), with TypeScript declarations, `"sideEffects": false`, and zero external runtime dependencies:
  - `@simple-api-stream/core` (`@simple-api-stream/core` and `@simple-api-stream/core/utils`) — Core event base classes, parser interfaces, and shared utilities.
  - `@simple-api-stream/json` — Streaming JSON (SAJ) utilities.
  - `@simple-api-stream/xml` — Streaming XML (SAX) utilities.
- Streaming JSON utilities (SAJ: Simple API for JSON):
  - `JSONTextToSAJEventWritableStream` — Executes SAJ events on a custom handler (`skipDocument`, `multiple`, and parse debug hooks `onParseBefore` / `onParseAfter` / `onParseLoopBefore` / `onParseLoopAfter`).
  - `JSONTextToSAJTransformStream` — Emits typed SAJ event objects from RFC 8259 JSON text with bounded streaming buffer (`skipDocument`, `multiple`, and parse debug hooks).
  - `ResolveToSAJReadableStream` — Programmatically resolves SAJ events (with idempotent `close()` and cancel-safe `Symbol.dispose` support).
  - `SAJToObjectTransformStream<T>` — Converts SAJ events into JavaScript values (`multiple`, `startDocument` / `endDocument` support, safe `Reflect.defineProperty` assignment).
  - `ObjectToSAJTransformStream<T>` — Converts JavaScript values (including `toJSON()`, general iterables such as `Set`, and async iterables) into SAJ events (`makeDocument`, `unSupported` options; circular reference detection and non-finite number handling).
  - `SAJToJSONTextTransformStream` — Serializes SAJ events back into valid JSON text (`summarize`, `indent`, `lineBreak` options, object key/value transition validation, non-finite number rejection, and incomplete structure validation on flush).
- Streaming XML utilities (SAX: Simple API for XML):
  - `XMLTextToSAXEventWritableStream` — Executes SAX events on a custom handler (`skipDocument` option).
  - `XMLTextToSAXTransformStream` — Emits typed SAX event objects from XML text with Unicode tag/attribute names, quoted `>` handling, tag nesting/unclosed element validation, safe numeric & HTML5 entity unescaping, and verbatim comments (`skipDocument` option).
  - `ResolveToSAXReadableStream` — Programmatically resolves SAX events (with idempotent `close()` and cancel-safe `Symbol.dispose` support).
  - `SAXToXMLTextTransformStream` — Converts SAX events back to XML text (`indent`, `lineBreak`, `summarize` options, delimiter validation for CDATA/comment/PI).
- Consistent `TransformStream` error propagation on both readable and writable sides, with minify-safe explicit state names in `status.state` and error snapshots.
- Documentation:
  - Architecture overview, feature matrix, usage examples, option tables, event format references, error classes, and subpath export guide in `README.md`.

[Unreleased]: https://github.com/simple-api-stream/simple-api-stream/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/simple-api-stream/simple-api-stream/releases/tag/v1.0.0
