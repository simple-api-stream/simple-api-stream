/**
 * Matcher controlling how `Content-Type` headers are validated:
 * - `true`: use the format's default `Content-Type` matcher (no-op when no default matcher is supplied)
 * - `false`: disable `Content-Type` validation
 * - `RegExp`: test against the raw `Content-Type` header value
 * - `(contentType: string | null) => boolean`: custom validation predicate
 */
export type ContentTypeMatcher = boolean | RegExp | ((contentType: string | null) => boolean);

/**
 * Configuration options for `responseToTextStream`.
 */
export type ResponseToTextStreamOptions = {
  /** When `true`, throws `ResponseStreamError` if `!response.ok` (default: `false`). */
  checkOk?: boolean
  /** Validate the `Content-Type` header (`false` disables validation). */
  checkContentType?: ContentTypeMatcher
  /** Character encoding passed to `TextDecoderStream` (defaults to `charset` from `Content-Type`, or `"utf-8"`). */
  encoding?: string
  /** Options forwarded to `TextDecoderStream` (`fatal`, `ignoreBOM`). */
  decoder?: TextDecoderOptions
};

/**
 * Error thrown when a Fetch `Response` fails validation (`checkOk`, `checkContentType`, or missing `body`).
 */
export class ResponseStreamError extends Error {
  status: number;
  contentType: string | null;

  constructor(
    message: string,
    info: { status: number, contentType: string | null },
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ResponseStreamError";
    this.status = info.status;
    this.contentType = info.contentType;
  }
}

/**
 * Extracts the lowercased media type (before any `;` parameters) from a `Content-Type` header value.
 */
export function parseMediaType(contentType: string | null): string | null {
  if (!contentType) return null;
  const semi = contentType.indexOf(";");
  const mediaType = (semi === -1 ? contentType : contentType.slice(0, semi)).trim().toLowerCase();
  return mediaType.length > 0 ? mediaType : null;
}

const CHARSET_REGEX = /;\s*charset\s*=\s*(?:"([^"]+)"|([^\s;]+))/i;

/**
 * Extracts the `charset` parameter from a `Content-Type` header value, if present.
 */
export function extractCharset(contentType: string | null): string | undefined {
  if (!contentType) return undefined;
  const match = CHARSET_REGEX.exec(contentType);
  const value = (match?.[1] ?? match?.[2])?.trim();
  return value && value.length > 0 ? value : undefined;
}

/**
 * Validates a Fetch `Response` and decodes its body stream into a `ReadableStream<string>` using `TextDecoderStream`.
 */
export function responseToTextStream(
  response: Response,
  options?: ResponseToTextStreamOptions,
  defaultContentTypeMatcher?: (mediaType: string | null) => boolean,
): ReadableStream<string> {
  const contentType = response.headers.get("content-type");
  const info = { status: response.status, contentType };

  if (options?.checkOk && !response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    throw new ResponseStreamError(`Response is not ok: ${response.status}${statusText}`, info);
  }

  const check = options?.checkContentType ?? (defaultContentTypeMatcher !== undefined);
  if (check === true) {
    if (defaultContentTypeMatcher && !defaultContentTypeMatcher(parseMediaType(contentType))) {
      throw new ResponseStreamError(`Unexpected Content-Type: ${contentType ?? "(missing)"}`, info);
    }
  }
  else if (check instanceof RegExp) {
    if (!contentType || !check.test(contentType)) {
      throw new ResponseStreamError(`Unexpected Content-Type: ${contentType ?? "(missing)"}`, info);
    }
  }
  else if (typeof check === "function") {
    if (!check(contentType)) {
      throw new ResponseStreamError(`Unexpected Content-Type: ${contentType ?? "(missing)"}`, info);
    }
  }

  if (response.body === null) {
    throw new ResponseStreamError("Response body is null", info);
  }

  const encoding = options?.encoding ?? extractCharset(contentType) ?? "utf-8";
  return response.body.pipeThrough(new TextDecoderStream(encoding, options?.decoder));
}
