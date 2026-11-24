# @simple-api-stream/sse

Streaming Server-Sent Events (`text/event-stream`) parser, serializer, and Fetch `Response` helper built on the [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Streams_API).

## Installation

```bash
npm install @simple-api-stream/sse
```

Requires Node.js **>= 24** or any runtime supporting Web Streams and async iteration of `ReadableStream`.

## Features

| Export | Type | Input | Output |
|--------|------|-------|--------|
| [`SSETextToEventTransformStream`](./src/SSETextToEventTransformStream.ts) | `TransformStream` | SSE text (`string` chunks) | `SSEEventInterface` objects |
| [`SSEEventToTextTransformStream`](./src/SSEEventToTextTransformStream.ts) | `TransformStream` | `SSEEventInterface` objects | SSE text (`text/event-stream`) |
| [`parseSSEResponse<T>`](./src/parseSSEResponse.ts) | Helper function | Fetch `Response` | `ReadableStream<T>` (`SSEMessage` or mapped `T`) |

## Usage

```ts
import { parseSSEResponse } from "@simple-api-stream/sse";

const response = await fetch("https://example.com/events");
for await (const msg of parseSSEResponse(response)) {
  console.log(msg.event ?? "message", msg.data, msg.id);
}
```

For full options and usage examples, see the [root README](../../README.md).

## See Also

- [WHATWG HTML Living Standard — Server-Sent Events (`text/event-stream`)](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/)
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)

## License

[MIT](./LICENSE)
