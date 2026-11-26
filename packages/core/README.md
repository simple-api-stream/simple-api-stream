# @simple-api-stream/core

Core event classes, parser interfaces, and Fetch `Response` helpers for the `simple-api-stream` package family.

## Installation

```bash
npm install @simple-api-stream/core
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Exports

### `@simple-api-stream/core`

- Event classes: `SAEvent`, `StartDocumentEvent`, `EndDocumentEvent`, `ErrorEvent`, `CommentEvent`
- Event interfaces (types): `StartDocumentSAEventInterface`, `EndDocumentSAEventInterface`, `ErrorSAEventInterface`, `CommentSAEventInterface`
- Parser interface (type): `SimpleApiParser<T>`
- Fetch `Response` helpers: `responseToTextStream`, `ResponseStreamError`, `parseMediaType`, `extractCharset`, and types `ResponseToTextStreamOptions`, `ContentTypeMatcher`

For full documentation and usage examples, see the [root README](../../README.md).

## See Also

- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)
- [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/)
- [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/)
- [RFC 9110 — HTTP Semantics (`Content-Type`)](https://datatracker.ietf.org/doc/html/rfc9110#name-content-type)

## License

[MIT](./LICENSE)
