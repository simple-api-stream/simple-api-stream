import { describe, expect, test, vi } from "vitest";
import * as json from "./index.js";
import { JSONTextToSAJTransformStream } from "./index.js";
const JSONTextToSAJParserError = json.streams.JSONTextToSAJParserError;
type SAJEventInterface = json.eventInterfaces.SAJEventInterface;
describe("pattern", (it) => {
  const entries: {
    name: string
    options?: ConstructorParameters<typeof JSONTextToSAJTransformStream>[0]
    input: string[]
    output: SAJEventInterface[]
  }[] = [
    {
      name: "all type",
      input: [
        `{"num":0,"str":"value", \n`,
        `"bool1": true, "bool2": false, "nullable":null,   "arry": [
        "test"
        ]}`,
      ],
      output: [
        { name: "startDocument", kind: "json" },
        { name: "startObject" },
        { name: "key", key: "num" },
        { name: "value", type: "number", value: 0 },
        { name: "key", key: "str" },
        { name: "value", type: "string", value: "value" },
        { name: "key", key: "bool1" },
        { name: "value", type: "boolean", value: true },
        { name: "key", key: "bool2" },
        { name: "value", type: "boolean", value: false },
        { name: "key", key: "nullable" },
        { name: "value", type: "null", value: null },
        { name: "key", key: "arry" },
        { name: "startArray" },
        { name: "value", type: "string", value: "test" },
        { name: "endArray" },
        { name: "endObject" },
        { name: "endDocument" },
      ],
    },
    {
      name: "space and array",
      options: { skipDocument: true },
      input: [
        `       [    true   ]         `,
      ],
      output: [
        { name: "startArray" },
        { name: "value", type: "boolean", value: true },
        { name: "endArray" },
      ],
    },
    {
      name: "empty object",
      input: [
        `{}`,
      ],
      output: [
        { name: "startDocument", kind: "json" },
        { name: "startObject" },
        { name: "endObject" },
        { name: "endDocument" },
      ],
    },
    {
      name: "space and object",
      options: { skipDocument: true },
      input: [
        `       {    "value": 1   }         `,
      ],
      output: [
        { name: "startObject" },
        { name: "key", key: "value" },
        { name: "value", type: "number", value: 1 },
        { name: "endObject" },
      ],
    },
    {
      name: "simple value number",
      options: { skipDocument: true },
      input: [
        `1`,
      ],
      output: [
        { name: "value", type: "number", value: 1 },
      ],
    },
    {
      name: "simple value string",
      options: { skipDocument: true },
      input: [
        `"hoge"`,
      ],
      output: [
        { name: "value", type: "string", value: "hoge" },
      ],
    },
    {
      name: "escaped value string",
      options: { skipDocument: true },
      input: [
        `"hoge\\"fuga"`,
      ],
      output: [
        { name: "value", type: "string", value: "hoge\"fuga" },
      ],
    },
    {
      name: "simple value boolean",
      options: { skipDocument: true },
      input: [
        `false`,
      ],
      output: [
        { name: "value", type: "boolean", value: false },
      ],
    },
    {
      name: "simple value null",
      options: { skipDocument: true },
      input: [
        `null`,
      ],
      output: [
        { name: "value", type: "null", value: null },
      ],
    },
    {
      name: "standalone number with trailing whitespace",
      input: [
        `123\n`,
      ],
      output: [
        { name: "startDocument", kind: "json" },
        { name: "value", type: "number", value: 123 },
        { name: "endDocument" },
      ],
    },
    {
      name: "standalone string with trailing whitespace",
      input: [
        `"hello"  \r\n`,
      ],
      output: [
        { name: "startDocument", kind: "json" },
        { name: "value", type: "string", value: "hello" },
        { name: "endDocument" },
      ],
    },
    {
      name: "standalone boolean with trailing whitespace",
      input: [
        `true `,
      ],
      output: [
        { name: "startDocument", kind: "json" },
        { name: "value", type: "boolean", value: true },
        { name: "endDocument" },
      ],
    },
    {
      name: "standalone null with trailing whitespace",
      input: [
        `null\n`,
      ],
      output: [
        { name: "startDocument", kind: "json" },
        { name: "value", type: "null", value: null },
        { name: "endDocument" },
      ],
    },
    {
      name: "crlf array",
      input: [
        `\t
          [\r\n
            null
            ,



            null,

            null
          ]`,
      ],
      output: [
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "startArray",
        },
        {
          name: "value",
          type: "null",
          value: null,
        },
        {
          name: "value",
          type: "null",
          value: null,
        },
        {
          name: "value",
          type: "null",
          value: null,
        },
        {
          name: "endArray",
        },
        {
          name: "endDocument",
        },
      ],
    },
    {
      name: "crlf object",
      input: [
        `\t
          {\r\n
            "value1":null
            ,

            "value2"
            :
            null,

            "value3"

            :null
          }`,
      ],
      output: [
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "startObject",
        },
        {
          key: "value1",
          name: "key",
        },
        {
          name: "value",
          type: "null",
          value: null,
        },
        {
          key: "value2",
          name: "key",
        },
        {
          name: "value",
          type: "null",
          value: null,
        },
        {
          key: "value3",
          name: "key",
        },
        {
          name: "value",
          type: "null",
          value: null,
        },
        {
          name: "endObject",
        },
        {
          name: "endDocument",
        },
      ],
    },
    {
      name: "multipledocument",
      options: { multiple: true },
      input: [
        `1
          2`,
      ],
      output: [
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 1,
        },
        {
          name: "endDocument",
        },
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 2,
        },
        {
          name: "endDocument",
        },
      ],
    },
    {
      name: "json-seq",
      options: { multiple: "json-seq" },
      input: [
        "\x1E{\"a\":1}\n\x1E2\x1E\x1E3\n\x1E",
      ],
      output: [
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "startObject",
        },
        {
          name: "key",
          key: "a",
        },
        {
          name: "value",
          type: "number",
          value: 1,
        },
        {
          name: "endObject",
        },
        {
          name: "endDocument",
        },
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 2,
        },
        {
          name: "endDocument",
        },
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 3,
        },
        {
          name: "endDocument",
        },
      ],
    },
    {
      name: "empty",
      input: [""],
      output: [],
    },
    {
      name: "parseValueOrEndArray",
      input: [
        `[
          "hoge",
          "fuga",
          []
          ]`,
      ],
      output: [
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "startArray",
        },
        {
          name: "value",
          type: "string",
          value: "hoge",
        },
        {
          name: "value",
          type: "string",
          value: "fuga",
        },
        {
          name: "startArray",
        },
        {
          name: "endArray",
        },
        {
          name: "endArray",
        },
        {
          name: "endDocument",
        },
      ],
    },
    {
      name: "multiple document",
      options: { multiple: true },
      input: [
        `1
          2
          3
          4
          5`,
      ],
      output: [
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 1,
        },
        {
          name: "endDocument",
        },
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 2,
        },
        {
          name: "endDocument",
        },
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 3,
        },
        {
          name: "endDocument",
        },
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 4,
        },
        {
          name: "endDocument",
        },
        {
          kind: "json",
          name: "startDocument",
        },
        {
          name: "value",
          type: "number",
          value: 5,
        },
        {
          name: "endDocument",
        },
      ],
    },
    {
      name: "escaped unicode string",
      input: [
        `"テスト\\u3000メッセージ"`,
      ],
      output: [
        { name: "startDocument", kind: "json" },
        { name: "value", type: "string", value: "テスト　メッセージ" },
        { name: "endDocument" },
      ],
    },
    {
      name: "escaped unicode string (surrogate pair)",
      input: [
        `"\\uD83D\\uDE00"`,
      ],
      output: [
        { name: "startDocument", kind: "json" },
        { name: "value", type: "string", value: "😀" },
        { name: "endDocument" },
      ],
    },
  ];
  it.each(entries)("$name", async ({ input, output, options }) => {
    const { writable, readable } = new JSONTextToSAJTransformStream(options);
    const writed = (async () => {
      const writer = writable.getWriter();
      for (const i of input) {
        for (const chunk of i.match(/.{1,10}/g) ?? [])
          await writer.write(chunk);
      }
      await writer.close();
    })();
    const readed = Array.fromAsync(readable);
    try {
      await expect(writed).resolves.toBeUndefined();
      await expect(readed).resolves.toEqual(output);
    }
    catch (e) {
      const e2 = readed.catch((v: unknown) => v);
      if (e2 instanceof json.streams.JSONTextToSAJParserError) {
        console.dir(e2.cause);
      }
      throw e;
    }
  });
});

describe("error", (it) => {
  const entries: {
    name: string
    options?: ConstructorParameters<typeof JSONTextToSAJTransformStream>[0]
    input: string[]
    output:
      Record<"read" | "write", {
        error: (string | RegExp | (new (...args: (ConstructorParameters<typeof JSONTextToSAJParserError>)) => unknown) | Error | undefined)[]
      } | {
        result: unknown[] | undefined
      }>
  }[] = [
    {
      name: "parse error",
      input: [
        `
          {
          "hoge":
            "hoge"
            ,"fuga"
          }`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Expected colon after key but got: }`,
          ],
        },
      },
    },
    {
      name: "not support multiple in single",
      options: { multiple: false },
      input: [
        `
          "hoge"
          "fuga"
          `,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `is closed document`,
          ],
        },
      },
    },
    {
      name: "reject json-seq RS when multiple is true",
      options: { multiple: true },
      input: [
        "\x1E1\n",
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            "Unexpected token: \x1E",
          ],
        },
      },
    },
    {
      name: "invalid eol from array",
      input: [`
          [
          "fuga"
            `],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "invalid eol from object",
      input: [`
          {
          "fuga":"fuga"
            `],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "invalid eol from object with conma",
      input: [`
          {
          "fuga":"fuga",
            `],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "invalid eol from object block after",
      input: [`
          {
          "fuga":{"fuga":"fuge"}
            `],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "invalid initial character",
      input: [
        `}`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            "Unexpected token: }",
          ],
        },
      },
    },
    {
      name: "invalid keyOrEndObject",
      input: [
        `{{`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            "Unexpected token in object: {",
          ],
        },
      },
    },
    {
      name: "parseColon to eol",
      input: [
        `{ "hoge"`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "parseValue to eol",
      input: [
        `{ "hoge":`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "invalid parseValue ",
      input: [
        "{ \"hoge\":`",
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Unexpected value: \``,
          ],
        },
      },
    },
    {
      name: "invalid parseCommaOrEndObject ",
      input: [
        "{ \"hoge\":\"fuge\"{",
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Expected , or } but got: {`,
          ],
        },
      },
    },
    {
      name: "parseValueOrEndArray to eol",
      input: [
        `[`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "invalid parseCommaOrEndArray",
      input: [
        `[1 {`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Expected , or ] but got: {`,
          ],
        },
      },
    },
    {
      name: "parseValueInArray to eol",
      input: [
        `[1,`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "parseString to eol",
      input: [
        `"hoge`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "escaped string invalid escape",
      input: [
        `"\\z"`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid escape: \\z: z`,
          ],
        },
      },
    },
    {
      name: "invalid escaped unicode string to eol",
      input: [
        `"テスト\\u300メッセージ"`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid unicode escape: メ`,
          ],
        },
      },
    },
    {
      name: "invalid parseLiteral",
      input: [
        `treu`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid literal: tre`,
          ],
        },
      },
    },
    {
      name: "parseLiteral to eol",
      input: [
        `tru`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "invalid parseNumber",
      input: [
        `-123e-10e`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid number: -123e-10e`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid number: -123e-10e`,
          ],
        },
      },
    },
    {
      name: "trailing comma in object",
      input: [
        `{"a": 1,}`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Unexpected token in object: }`,
          ],
        },
      },
    },
    {
      name: "unclosed empty object",
      input: [
        `{`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `not complete syntax error. buffer:`,
          ],
        },
      },
    },
    {
      name: "leading zero number",
      input: [
        `01`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid number: 01`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid number: 01`,
          ],
        },
      },
    },
    {
      name: "trailing dot number",
      input: [
        `1.`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid number: 1.`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid number: 1.`,
          ],
        },
      },
    },
    {
      name: "leading dot negative number",
      input: [
        `-.5`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid number: -.5`,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Invalid number: -.5`,
          ],
        },
      },
    },
    {
      name: "unescaped control character in string",
      input: [
        `"a\nb"`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Unescaped control character in string`,
          ],
        },
      },
    },
    {
      name: "non-JSON whitespace (full-width space)",
      input: [
        `\u3000{}`,
      ],
      output: {
        write: {
          error: [
            json.streams.JSONTextToSAJParserError,
          ],
        },
        read: {
          error: [
            json.streams.JSONTextToSAJParserError,
            `Unexpected token: \u3000`,
          ],
        },
      },
    },
  ];
  it.each(entries)("$name", async ({ input, output: { read, write }, options }) => {
    const { readable, writable } = new JSONTextToSAJTransformStream(options);
    const writed = (async () => {
      const writer = writable.getWriter();
      for (const text of input)
        await writer.write(text);
      await writer.close();
    })();
    const readed = Array.fromAsync(readable);

    for (const [resultType, result] of [
      [read, readed],
      [write, writed],
    ] as const) {
      if ("error" in resultType) {
        for (const error of resultType.error)
          try {
            await expect(result).rejects.toThrow(error);
          }
          catch (e) {
            const error = await result.catch((v: unknown) => v);
            console.dir(error);
            throw e;
          }
      }
      else {
        if (resultType.result === undefined)
          await expect(result).resolves.toBeUndefined();
        else
          await expect(result).resolves.toEqual(resultType.result);
      }
    }
  });
});
test("debug", async ({ expect }) => {
  type Handler = Required<Pick<NonNullable<ConstructorParameters<typeof JSONTextToSAJTransformStream>[0]>, "onParseAfter" | "onParseBefore" | "onParseLoopAfter" | "onParseLoopBefore">>;
  const handler: Handler = {
    onParseAfter: vi.fn(),
    onParseBefore: vi.fn(),
    onParseLoopAfter: vi.fn(),
    onParseLoopBefore: vi.fn(),
  };
  const { readable, writable, status } = new JSONTextToSAJTransformStream(handler);
  const readed = Array.fromAsync(readable);
  const writed = (async () => {
    const writer = writable.getWriter();
    await writer.write(`"hello"`);
    await writer.close();
  })();
  await expect(readed).resolves.toEqual([
    {
      kind: "json",
      name: "startDocument",
    },
    {
      name: "value",
      type: "string",
      value: "hello",
    },
    {
      name: "endDocument",
    },
  ]);
  expect(status).toEqual({
    acc: "",
    buffer: "",
    key: null,
    pos: 0,
    state: "#startDocument",
    typeStack: [],
  });
  await expect(writed).resolves.toBeUndefined();
  expect(handler.onParseAfter).toHaveBeenCalledTimes(2);
  expect(handler.onParseBefore).toHaveBeenCalledTimes(2);
  expect(handler.onParseLoopAfter).toHaveBeenCalledTimes(7);
  expect(handler.onParseLoopBefore).toHaveBeenCalledTimes(7);
});

test("clears consumed buffer after each chunk to avoid unbounded growth", async ({ expect }) => {
  const stream = new JSONTextToSAJTransformStream({ multiple: true });
  const writer = stream.writable.getWriter();
  const readed = Array.fromAsync(stream.readable);

  for (let i = 0; i < 100; i++) {
    await writer.write(`{"i":${i}}\n`);
    expect(stream.status.buffer).toBe("");
    expect(stream.status.pos).toBe(0);
  }
  await writer.close();
  const events = await readed;
  expect(events.length).toBe(100 * 6);
  expect(stream.status.buffer).toBe("");
  expect(stream.status.pos).toBe(0);
});

test("reports explicit state names during parsing and on error", async ({ expect }) => {
  const states: string[] = [];
  const stream = new JSONTextToSAJTransformStream({
    onParseLoopAfter: (status) => {
      states.push(status.state);
    },
  });
  const writer = stream.writable.getWriter();
  const readed = Array.fromAsync(stream.readable);
  await writer.write(`{"a":1}`);
  await writer.close();
  await readed;

  expect(states).toContain("KeyOrEndObject");
  expect(states).toContain("parseStringHandler");
  expect(states).toContain("Colon");
  expect(states).toContain("Value");
  expect(states).toContain("parseNumberHandler");
  expect(states).toContain("AfterValue");
  expect(stream.status.state).toBe("#startDocument");
});

test("re-exports stream classes as both values and types and includes JSONTextToSAJTransformStream in streams", ({ expect }) => {
  expect(json.streams.JSONTextToSAJTransformStream).toBe(JSONTextToSAJTransformStream);
  const stream: JSONTextToSAJTransformStream = new JSONTextToSAJTransformStream();
  expect(stream).toBeInstanceOf(JSONTextToSAJTransformStream);
});

test("supports errorToEvent: true with multiple: json-seq", async ({ expect }) => {
  // Error mid-record with trailing chars before next RS, and valid next record
  const stream1 = new JSONTextToSAJTransformStream({ multiple: "json-seq", errorToEvent: true });
  const writer1 = stream1.writable.getWriter();
  const readed1 = Array.fromAsync(stream1.readable);
  await writer1.write("\x1E{\"a\":bad}\n\x1E{\"b\":2}\n");
  await writer1.close();
  const events1 = await readed1;
  expect(events1.map(e => e.name)).toEqual([
    "startDocument",
    "startObject",
    "key",
    "error",
    "endDocument",
    "startDocument",
    "startObject",
    "key",
    "value",
    "endObject",
    "endDocument",
  ]);
  const errorEvent1 = events1.find(e => e.name === "error");
  expect(errorEvent1?.error).toBeInstanceOf(json.streams.JSONTextToSAJParserError);

  // Incomplete record on flush (EOF) and skipDocument: true
  const stream2 = new JSONTextToSAJTransformStream({ multiple: "json-seq", errorToEvent: true, skipDocument: true });
  const writer2 = stream2.writable.getWriter();
  const readed2 = Array.fromAsync(stream2.readable);
  await writer2.write("\x1E{\"a\":bad}\n\x1E{\"b\":1");
  await writer2.close();
  const events2 = await readed2;
  expect(events2.map(e => e.name)).toEqual([
    "startObject",
    "key",
    "error",
    "startObject",
    "key",
    "value",
    "error",
  ]);

  // Incomplete record on flush when error already transitioned to #skipToNextRecord (EOL)
  const stream3 = new JSONTextToSAJTransformStream({ multiple: "json-seq", errorToEvent: true });
  const writer3 = stream3.writable.getWriter();
  const readed3 = Array.fromAsync(stream3.readable);
  await writer3.write("\x1E{\"a\":bad");
  await writer3.close();
  const events3 = await readed3;
  expect(events3.map(e => e.name)).toEqual([
    "startDocument",
    "startObject",
    "key",
    "error",
    "endDocument",
  ]);

  // Incomplete record on flush with skipDocument: true (already in #skipToNextRecord)
  const stream4 = new JSONTextToSAJTransformStream({ multiple: "json-seq", errorToEvent: true, skipDocument: true });
  const writer4 = stream4.writable.getWriter();
  const readed4 = Array.fromAsync(stream4.readable);
  await writer4.write("\x1E{\"a\":bad");
  await writer4.close();
  const events4 = await readed4;
  expect(events4.map(e => e.name)).toEqual([
    "startObject",
    "key",
    "error",
  ]);

  // Incomplete record on flush with document started (normal error on EOL)
  const stream5 = new JSONTextToSAJTransformStream({ multiple: "json-seq", errorToEvent: true });
  const writer5 = stream5.writable.getWriter();
  const readed5 = Array.fromAsync(stream5.readable);
  await writer5.write("\x1E{\"a\":1");
  await writer5.close();
  const events5 = await readed5;
  expect(events5.map(e => e.name)).toEqual([
    "startDocument",
    "startObject",
    "key",
    "value",
    "error",
    "endDocument",
  ]);
});
