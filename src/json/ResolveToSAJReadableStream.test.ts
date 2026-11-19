import { describe, expect, test } from "vitest";
import type * as json from "./index.js";
import { ResolveToSAJReadableStream } from "../index.js";

type SAJEventInterface = json.eventInterfaces.SAJEventInterface;
describe("pattern", (it) => {
  const entries: {
    name: string
    input: ((stream: InstanceType<typeof ResolveToSAJReadableStream>) => void)[]
    output: SAJEventInterface[]
  }[] = [
    {
      name: "all type",
      input: [
        stream => stream.startDocument(),
        stream => stream.startObject(),
        stream => stream.key("num"),
        stream => stream.value("number", 0),
        stream => stream.key("str"),
        stream => stream.value("string", "value"),
        stream => stream.key("bool1"),
        stream => stream.value("boolean", true),
        stream => stream.key("bool2"),
        stream => stream.value("boolean", false),
        stream => stream.key("nullable"),
        stream => stream.value("null", null),
        stream => stream.key("arry"),
        stream => stream.startArray(),
        stream => stream.value("string", "test"),
        stream => stream.endArray(),
        stream => stream.endObject(),
        stream => stream.endDocument(),
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
  ];
  it.each(entries)("$name", async ({ input, output }) => {
    const result = await (async () => {
      const stream = (() => {
        using stream = new ResolveToSAJReadableStream();
        for (const action of input)
          action(stream);
        return stream;
      })();
      return Array.fromAsync(stream);
    })();
    expect(result).toEqual(output);
  });
});

test("dispose is safe after explicit close or consumer cancel", async ({ expect }) => {
  {
    using stream = new ResolveToSAJReadableStream();
    stream.value("number", 1);
    stream.close();
    await expect(Array.fromAsync(stream)).resolves.toEqual([{ name: "value", type: "number", value: 1 }]);
  }
  {
    using stream = new ResolveToSAJReadableStream();
    stream.value("number", 1);
    await stream.cancel();
  }
});
