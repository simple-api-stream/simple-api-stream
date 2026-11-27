import { TOMLTextToSATTransformStream, type eventInterfaces } from "@simple-api-stream/toml";
import { describe, expect, it } from "vitest";
import { SAIToINITextTransformStream } from "../index.js";
import { SATToSAITransformStream, SATToSAITransformStreamError } from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SATToSAITransformStream", () => {
  it("converts TOML text into INI text with dotted tables and stringified primitives", async () => {
    const toml = [
      "# config",
      "title = \"Demo\"",
      "enabled = true",
      "[db.primary]",
      "port = 5432",
      "ratio = 0.5",
      "",
    ].join("\n");

    const converter = new SATToSAITransformStream();
    expect(converter.status.unSupported[0]).toBe("ignore");

    const ini = (await Array.fromAsync(
      from([toml])
        .pipeThrough(new TOMLTextToSATTransformStream({ comments: true }))
        .pipeThrough(converter)
        .pipeThrough(new SAIToINITextTransformStream({ comments: true, summarize: true })),
    )).join("");

    expect(ini).toBe([
      "# config",
      "title=Demo",
      "enabled=true",
      "[db.primary]",
      "port=5432",
      "ratio=0.5",
      "",
    ].join("\n"));
  });

  it("supports makeDocument: false and comments: false", async () => {
    const events = await Array.fromAsync(
      from(["# ignored\na = \"1\"\n"])
        .pipeThrough(new TOMLTextToSATTransformStream({ comments: true }))
        .pipeThrough(new SATToSAITransformStream({ makeDocument: false, comments: false })),
    );
    expect(events).toEqual([{ name: "entry", key: "a", value: "1" }]);
  });

  it("ignores arrays, inline tables, and array tables (including nested comments/arrays) by default", async () => {
    const toml = [
      "a = \"keep\"",
      "tags = [1, [2, 3]]",
      "inline = { x = 1, y = { z = 2 } }",
      "[[items]]",
      "# comment inside skipped arrayTable",
      "name = \"skip-me\"",
      "arr = [1, 2]",
      "[after]",
      "ok = true",
      "",
    ].join("\n");

    const ini = (await Array.fromAsync(
      from([toml])
        .pipeThrough(new TOMLTextToSATTransformStream({ comments: true }))
        .pipeThrough(new SATToSAITransformStream())
        .pipeThrough(new SAIToINITextTransformStream({ comments: true, summarize: true })),
    )).join("");

    expect(ini).toBe("a=keep\n[after]\nok=true\n");
  });

  it("errors on unsupported TOML constructs when unSupported is error", async () => {
    const errConverter = new SATToSAITransformStream({ unSupported: "error" });
    expect(errConverter.status.unSupported[0]).toBe("error");

    await expect(
      Array.fromAsync(
        from(["tags = [1, 2]\n"])
          .pipeThrough(new TOMLTextToSATTransformStream())
          .pipeThrough(errConverter),
      ),
    ).rejects.toThrow(SATToSAITransformStreamError);

    await expect(
      Array.fromAsync(
        from(["[[items]]\nname = \"a\"\n"])
          .pipeThrough(new TOMLTextToSATTransformStream())
          .pipeThrough(new SATToSAITransformStream({ unSupported: "error" })),
      ),
    ).rejects.toThrow(SATToSAITransformStreamError);
  });

  it("supports custom unSupported handler for arrayTable and containers, and validates return value", async () => {
    let itemIndex = 0;
    const customConverter = new SATToSAITransformStream({
      unSupported: ({ event, skip }) => {
        if (event.name === "arrayTable") {
          return `${event.path.join(".")}.${itemIndex++}`;
        }
        if (event.name === "startArray") {
          return "array-placeholder";
        }
        return skip;
      },
    });
    expect(customConverter.status.unSupported[0]).toBe("custom");

    const toml = "tags = [1, 2]\ninline = { a = 1 }\n[[items]]\nname = \"first\"\n[[items]]\nname = \"second\"\n";
    const ini = (await Array.fromAsync(
      from([toml])
        .pipeThrough(new TOMLTextToSATTransformStream())
        .pipeThrough(customConverter)
        .pipeThrough(new SAIToINITextTransformStream({ summarize: true })),
    )).join("");

    expect(ini).toBe("tags=array-placeholder\n[items.0]\nname=first\n[items.1]\nname=second\n");

    // Non-string return from custom handler errors
    await expect(
      Array.fromAsync(
        from(["tags = [1]\n"])
          .pipeThrough(new TOMLTextToSATTransformStream())
          .pipeThrough(new SATToSAITransformStream({
            unSupported: () => 123 as unknown as string,
          })),
      ),
    ).rejects.toThrow(SATToSAITransformStreamError);
  });

  it("errors on invalid SAT event sequences", async () => {
    const invalidSequences: eventInterfaces.SATEventInterface[][] = [
      [{ name: "startDocument", kind: "toml" }, { name: "key", path: ["a"] }, { name: "endDocument" }],
      [{ name: "key", path: ["a"] }, { name: "table", path: ["t"] }],
      [{ name: "key", path: ["a"] }, { name: "arrayTable", path: ["t"] }],
      [{ name: "key", path: ["a"] }, { name: "key", path: ["b"] }],
      [{ name: "endArray" }],
      [{ name: "endInlineTable" }],
      [{ name: "value", type: "string", value: "orphan" }],
      [{ name: "key", path: ["a"] }], // flush with pending key
      [{ name: "key", path: ["a"] }, { name: "startArray" }], // flush with unclosed container
      [{ name: "startArray" }], // startArray without preceding key
    ];

    for (const seq of invalidSequences) {
      if (seq.length === 1 && seq[0].name === "startArray") {
        // startArray without key + unclosed container -> errors on flush
        await expect(
          Array.fromAsync(from(seq).pipeThrough(new SATToSAITransformStream())),
        ).rejects.toThrow(SATToSAITransformStreamError);
      }
      else {
        await expect(
          Array.fromAsync(from(seq).pipeThrough(new SATToSAITransformStream())),
        ).rejects.toThrow(SATToSAITransformStreamError);
      }
    }
  });
});
