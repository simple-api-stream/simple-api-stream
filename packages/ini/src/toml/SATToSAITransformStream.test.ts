import { TOMLTextToSATTransformStream } from "@simple-api-stream/toml";
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

    const ini = (await Array.fromAsync(
      from([toml])
        .pipeThrough(new TOMLTextToSATTransformStream({ comments: true }))
        .pipeThrough(new SATToSAITransformStream())
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

  it("ignores arrays, inline tables, and array tables by default", async () => {
    const toml = [
      "a = \"keep\"",
      "tags = [1, [2, 3]]",
      "inline = { x = 1, y = { z = 2 } }",
      "[[items]]",
      "name = \"skip-me\"",
      "[after]",
      "ok = true",
      "",
    ].join("\n");

    const ini = (await Array.fromAsync(
      from([toml])
        .pipeThrough(new TOMLTextToSATTransformStream())
        .pipeThrough(new SATToSAITransformStream())
        .pipeThrough(new SAIToINITextTransformStream({ summarize: true })),
    )).join("");

    expect(ini).toBe("a=keep\n[after]\nok=true\n");
  });

  it("errors on unsupported TOML constructs when unSupported is error", async () => {
    await expect(
      Array.fromAsync(
        from(["tags = [1, 2]\n"])
          .pipeThrough(new TOMLTextToSATTransformStream())
          .pipeThrough(new SATToSAITransformStream({ unSupported: "error" })),
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

  it("supports custom unSupported handler", async () => {
    let itemIndex = 0;
    const toml = "[[items]]\nname = \"first\"\n[[items]]\nname = \"second\"\n";
    const ini = (await Array.fromAsync(
      from([toml])
        .pipeThrough(new TOMLTextToSATTransformStream())
        .pipeThrough(new SATToSAITransformStream({
          unSupported: ({ event, skip }) => {
            if (event.name === "arrayTable") {
              return `${event.path.join(".")}.${itemIndex++}`;
            }
            return skip;
          },
        }))
        .pipeThrough(new SAIToINITextTransformStream({ summarize: true })),
    )).join("");

    expect(ini).toBe("[items.0]\nname=first\n[items.1]\nname=second\n");
  });
});
