import { describe, expect, test } from "vitest";
import { SAJToJSONTextTransformStream } from "@simple-api-stream/json";
import { ResolveToSATReadableStream, TOMLTextToSATTransformStream } from "./index.js";
import { SATToSAJTransformStream } from "./json.js";

describe("SATToSAJTransformStream (@simple-api-stream/toml/json)", () => {
  test("pipes TOML text through SAT -> SAJ -> JSON text", async () => {
    const toml = `
title = "TOML to JSON"
flag = true
nan_val = nan
[server]
host = "localhost"
port = 8080
[[tags]]
name = "alpha"
[[tags]]
name = "beta"
`;
    const readable = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(toml);
        controller.close();
      },
    });

    const jsonChunks: string[] = [];
    await readable
      .pipeThrough(new TOMLTextToSATTransformStream())
      .pipeThrough(new SATToSAJTransformStream())
      .pipeThrough(new SAJToJSONTextTransformStream({ summarize: true }))
      .pipeTo(new WritableStream({
        write(chunk) {
          jsonChunks.push(chunk);
        },
      }));

    expect(JSON.parse(jsonChunks.join(""))).toEqual({
      title: "TOML to JSON",
      flag: true,
      nan_val: null,
      server: {
        host: "localhost",
        port: 8080,
      },
      tags: [
        { name: "alpha" },
        { name: "beta" },
      ],
    });
  });

  test("handles null values and stream flush without endDocument", async () => {
    const stream = new ResolveToSATReadableStream((r) => {
      r.key(["n"]);
      r.value("string", null as unknown as string);
    });
    const events: unknown[] = [];
    await stream
      .pipeThrough(new SATToSAJTransformStream())
      .pipeTo(new WritableStream({
        write(event) {
          events.push(event);
        },
      }));
    expect(events).toEqual([
      { name: "startDocument", kind: "json" },
      { name: "startObject" },
      { name: "key", key: "n" },
      { name: "value", type: "null", value: null },
      { name: "endObject" },
      { name: "endDocument" },
    ]);
  });
});
