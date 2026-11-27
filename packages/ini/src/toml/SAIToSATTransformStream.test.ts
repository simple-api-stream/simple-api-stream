import { SATToObjectTransformStream, SATToTOMLTextTransformStream } from "@simple-api-stream/toml";
import { describe, expect, it } from "vitest";
import { INITextToSAITransformStream } from "../index.js";
import { SAIToSATTransformStream } from "./index.js";

function from<T>(items: Iterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

describe("SAIToSATTransformStream", () => {
  it("streams INI text directly to TOML text preserving comments and order", async () => {
    const ini = [
      "; top comment",
      "title = My App",
      "[server]",
      "# host comment",
      "host = 127.0.0.1",
      "port = 8080",
      "",
    ].join("\n");

    const toml = (await Array.fromAsync(
      from([ini])
        .pipeThrough(new INITextToSAITransformStream({ comments: true }))
        .pipeThrough(new SAIToSATTransformStream())
        .pipeThrough(new SATToTOMLTextTransformStream({ comments: true, summarize: true })),
    )).join("");

    expect(toml).toBe([
      "# top comment",
      "title = \"My App\"",
      "[server]",
      "# host comment",
      "host = \"127.0.0.1\"",
      "port = \"8080\"",
      "",
    ].join("\n"));
  });

  it("supports splitDots option for dotted INI section names", async () => {
    const ini = "[db.primary]\nhost = localhost\n";

    const [nested] = await Array.fromAsync(
      from([ini])
        .pipeThrough(new INITextToSAITransformStream())
        .pipeThrough(new SAIToSATTransformStream({ splitDots: true }))
        .pipeThrough(new SATToObjectTransformStream()),
    );
    expect(nested).toEqual({ db: { primary: { host: "localhost" } } });

    const [flat] = await Array.fromAsync(
      from([ini])
        .pipeThrough(new INITextToSAITransformStream())
        .pipeThrough(new SAIToSATTransformStream({ splitDots: false }))
        .pipeThrough(new SATToObjectTransformStream()),
    );
    expect(flat).toEqual({ "db.primary": { host: "localhost" } });
  });
});
