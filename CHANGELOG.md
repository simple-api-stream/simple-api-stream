# Changelog

All notable changes to this project will be documented in this file.  
Adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

**Added**:

- `@simple-api-stream/core`: Added `responseToTextStream`, `ResponseStreamError`, `parseMediaType`, and `extractCharset` helpers for validating Fetch `Response` objects (`checkOk`, `checkContentType`, `charset` auto-detection) and decoding them to `ReadableStream<string>`.
- `@simple-api-stream/json`: Added `parseJSONResponse<T>` helper (auto-validates JSON/NDJSON/JSON-seq `Content-Type` and auto-detects `multiple` for NDJSON/JSONL/`application/json-seq`).
- `@simple-api-stream/csv`:
  - Added `SACToObjectTransformStream<T>` (with `mapRow`, `toObject`, `toArray`, and `skip` support), `ObjectToSACTransformStream<T>` (with `makeDocument`, `header`, `emitHeader`, `mapRow`, `formatValue`, and `skip` support), and `parseCSVResponse<T>` (auto-validates CSV/TSV `Content-Type` and auto-sets `delimiter: "\t"` for `text/tab-separated-values`).
  - Added `@simple-api-stream/csv/json` subpath exporting `SACToSAJTransformStream` (O(1) streaming SAC → SAJ with `rowFormat`, `multiple`, `makeDocument`, and `includeHeaderRow`) and `SAJToSACTransformStream` (streaming top-level JSON arrays and NDJSON row-by-row into SAC events; `@simple-api-stream/json` declared as an optional peer dependency).
- `@simple-api-stream/xml`:
  - Added `SAXToObjectTransformStream<T>` (reconstructing lightweight plain-object `XMLDocumentNode` ASTs with `mapDocument`, `ignoreWhitespaceText`, `ignoreComments`, and `skip`), `ObjectToSAXTransformStream<T>` (converting `XMLNode` ASTs or mapped values back to SAX events), `SAXToDOMTransformStream<T>` (constructing DOM `Document` / `DocumentFragment` trees via an injected or global `DOMDocumentFactoryLike`), and `DOMToSAXTransformStream` (converting zero-dependency `DOMNodeLike` nodes such as browser DOM / `jsdom` / `@xmldom/xmldom` into SAX events).
  - Added `@simple-api-stream/xml/json` subpath exporting `SAXToSAJTransformStream` (O(depth) streaming SAX → SAJ in lossless `XMLDocumentNode` AST JSON form) and `SAJToSAXTransformStream` (`@simple-api-stream/json` declared as an optional peer dependency).
  - Added `parseXMLResponse<T>` helper for streaming XML/`+xml` Fetch `Response` objects.
- `@simple-api-stream/toml`: Added `ObjectToSATTransformStream<T>` (with `makeDocument`, `unSupported`, `Date` → `offsetDateTime`, nested `[table]` / `[[arrayTable]]` ordering, inline tables, and circular reference detection), `SAJToSATTransformStream` (exported from `@simple-api-stream/toml/json` alongside `SATToSAJTransformStream`), and `parseTOMLResponse<T>` helper.
- `@simple-api-stream/sse`: Added new streaming Server-Sent Events (`text/event-stream`) package with `SSETextToEventTransformStream`, `SSEEventToTextTransformStream`, and `parseSSEResponse<T>` (supporting `mapMessage` + `skip`, `comments`, `stripBom`, and `flushIncomplete`).

## [1.1.0] - 2026-11-24

**Added**:

- `@simple-api-stream/core`: Added `CommentEvent` and `CommentSAEventInterface` (`name: "comment"`, `comment: string`) as shared comment event contracts across packages.
- `@simple-api-stream/csv`: Added new streaming CSV (SAC = Simple API for CSV) package with `CSVTextToSACTransformStream`, `CSVTextToSACEventWritableStream`, `SACToCSVTextTransformStream`, `ResolveToSACReadableStream`, and `CSVTextToSACParser` (supporting `header?: boolean | string[]`, `delimiter`, `quote`, `skipDocument`, `skipEmptyLines`, `stripBom`, `quotePolicy`, and `summarize`).
- `@simple-api-stream/json`:
  - Added `CommentEvent` (extending `@simple-api-stream/core`'s `CommentEvent`) and `CommentSAJEventInterface` (`name: "comment"`, `comment: string`, `style?: "line" | "block"`), `onComment` on `SAJHandler`, and `comment()` on `SAJResolver` / `ResolveToSAJReadableStream`.
  - Added `allowComments` and `allowTrailingCommas` options (both default to `false`) to `JSONTextToSAJParser`, `JSONTextToSAJTransformStream`, and `JSONTextToSAJEventWritableStream` for opt-in JSONC parsing.
  - Added `comments` option (defaults to `false`) to `SAJToJSONTextTransformStream` to optionally serialize `comment` events, and updated `SAJToObjectTransformStream` to ignore `comment` events.
- `@simple-api-stream/toml`:
  - Added new streaming TOML (SAT = Simple API for TOML) package with `TOMLTextToSATTransformStream`, `TOMLTextToSATEventWritableStream`, `SATToTOMLTextTransformStream`, `SATToObjectTransformStream`, `ResolveToSATReadableStream`, and `TOMLTextToSATParser`.
  - Added `@simple-api-stream/toml/json` subpath exporting `SATToSAJTransformStream` to convert SAT events into SAJ events (`@simple-api-stream/json` declared as an optional peer dependency).

**Changed**:

- **All packages**:
  - Added English JSDoc comments to exported declarations (classes, interfaces, types, and utility functions), public class methods/accessors (excluding constructors), and interface methods/callback properties across all packages.
  - Configured `prepack` / `postpack` scripts to bundle the root `CHANGELOG.md` into published package tarballs without dirtying the working tree.
  - Expanded test suites across `@simple-api-stream/csv`, `@simple-api-stream/json`, and `@simple-api-stream/toml` (reaching 100% coverage across the monorepo) and removed unused `assertIsTrue` utilities from `csv` and `toml`.

## [1.0.1] - 2026-11-20

**Added**:

- `@simple-api-stream/core`: Added `ErrorEvent` and `ErrorSAEventInterface` for representing parse errors as stream events.
- `@simple-api-stream/json`: Added `multiple: "json-seq"` and `errorToEvent` options to `JSONTextToSAJParser`, `JSONTextToSAJTransformStream`, and `JSONTextToSAJEventWritableStream` to parse RFC 7464 JSON text sequences (`\x1E` Record Separator delimited) and optionally emit `ErrorEvent` to recover at the next record.
- `@simple-api-stream/xml`: Added `multiple` option (`boolean`, defaults to `true`; planned to change default to `false` in a future version) to `XMLTextToSAXParser`, `XMLTextToSAXTransformStream`, and `XMLTextToSAXEventWritableStream` to optionally reject multiple root elements when `multiple: false`.

## [1.0.0] - 2026-11-20

**Added**:

- Initial release as an npm workspaces monorepo shipping ESM-only packages (targeting Node.js `>= 24`, also directly `require()`-able via `require(esm)`), with TypeScript declarations, `"sideEffects": false`, and zero external runtime dependencies:
  - `@simple-api-stream/core` — Core event base classes and parser interfaces.
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

[Unreleased]: https://github.com/simple-api-stream/simple-api-stream/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/simple-api-stream/simple-api-stream/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/simple-api-stream/simple-api-stream/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/simple-api-stream/simple-api-stream/releases/tag/v1.0.0
