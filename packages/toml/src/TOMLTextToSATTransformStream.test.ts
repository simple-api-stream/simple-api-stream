import { describe, expect, test } from "vitest";
import { TOMLTextToSATEventWritableStream, TOMLTextToSATTransformStream } from "./index.js";
import { TOMLTextToSATParser } from "./TOMLTextToSATParser.js";
import type { SATEventInterface } from "./event-interface/index.js";

async function collectEvents(chunks: string[], options?: ConstructorParameters<typeof TOMLTextToSATTransformStream>[0]): Promise<SATEventInterface[]> {
  const readable = new ReadableStream<string>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  const events: SATEventInterface[] = [];
  await readable.pipeThrough(new TOMLTextToSATTransformStream(options)).pipeTo(new WritableStream({
    write(event) {
      events.push(event);
    },
  }));
  return events;
}

describe("TOMLTextToSATTransformStream", () => {
  test("parses basic key-values, strings, escapes, numbers, booleans, and dates", async () => {
    const toml = [
      "# top comment",
      "title = \"TOML\\b\\t\\n\\f\\r\\\"\\\\\\u0041\\U0001F600\"",
      "\"quoted.key\" = 'C:\\Users\\nodejs\\templates'",
      "'lit.key' = \"val\" # eol comment",
      "count = 1_000",
      "hex = 0xdead_beef",
      "oct = 0o755",
      "bin = 0b1101_0110",
      "pi = 3.1415",
      "exp = 5e+22",
      "pos_inf = +inf",
      "neg_inf = -inf",
      "not_a_num = nan",
      "enabled = true",
      "disabled = false",
      "odt = 1979-05-27T07:32:00Z",
      "odt_space = 1979-05-27 07:32:00-07:00",
      "ldt = 1979-05-27T07:32:00",
      "ld = 1979-05-27",
      "lt = 07:32:00",
      "",
    ].join("\n");

    const stream = new TOMLTextToSATTransformStream({ comments: true });
    expect(stream.status.pos).toBe(0);

    const events: SATEventInterface[] = [];
    const readable = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("");
        controller.enqueue(toml);
        controller.close();
      },
    });
    await readable.pipeThrough(stream).pipeTo(new WritableStream({
      write(event) {
        events.push(event);
      },
    }));

    expect(events[0]).toEqual({ name: "startDocument", kind: "toml" });
    expect(events[1]).toEqual({ name: "comment", comment: " top comment" });
    expect(events).toContainEqual({ name: "key", path: ["title"] });
    expect(events).toContainEqual({ name: "value", type: "string", value: "TOML\b\t\n\f\r\"\\A\u{1F600}" });
    expect(events).toContainEqual({ name: "key", path: ["quoted.key"] });
    expect(events).toContainEqual({ name: "key", path: ["lit.key"] });
    expect(events).toContainEqual({ name: "comment", comment: " eol comment" });
    expect(events).toContainEqual({ name: "value", type: "integer", value: 1000 });
    expect(events).toContainEqual({ name: "value", type: "integer", value: 0xdeadbeef });
    expect(events).toContainEqual({ name: "value", type: "integer", value: 0o755 });
    expect(events).toContainEqual({ name: "value", type: "integer", value: 0b11010110 });
    expect(events).toContainEqual({ name: "value", type: "float", value: 3.1415 });
    expect(events).toContainEqual({ name: "value", type: "float", value: 5e22 });
    expect(events).toContainEqual({ name: "value", type: "float", value: Infinity });
    expect(events).toContainEqual({ name: "value", type: "float", value: -Infinity });
    const nanEvent = events.find(e => e.name === "value" && e.type === "float" && Number.isNaN(e.value));
    expect(nanEvent).toBeDefined();
    expect(events).toContainEqual({ name: "value", type: "boolean", value: true });
    expect(events).toContainEqual({ name: "value", type: "boolean", value: false });
    expect(events).toContainEqual({ name: "value", type: "offsetDateTime", value: "1979-05-27T07:32:00Z" });
    expect(events).toContainEqual({ name: "value", type: "offsetDateTime", value: "1979-05-27 07:32:00-07:00" });
    expect(events).toContainEqual({ name: "value", type: "localDateTime", value: "1979-05-27T07:32:00" });
    expect(events).toContainEqual({ name: "value", type: "localDate", value: "1979-05-27" });
    expect(events).toContainEqual({ name: "value", type: "localTime", value: "07:32:00" });
    expect(events[events.length - 1]).toEqual({ name: "endDocument" });
  });

  test("parses multiline strings, arrays, inline tables, and table headers across arbitrary 1-char chunks", async () => {
    const toml = [
      "ml_basic = \"\"\"",
      "hello \"\"\\ ",
      "  world\"\"\"",
      "ml_basic2 = \"\"\"a\"b\"\"c\"\"\"\"\"",
      "ml_lit = '''",
      "raw ''line''",
      "'''",
      "ml_lit2 = '''a'b''c'''''",
      "empty_arr = []",
      "empty_tbl = {}",
      "arr = [",
      "  1, # inline comment",
      "  2,",
      "]",
      "inline = { a = 1, b.c = \"x\", d = [true], e = { f = 2 } }",
      "[server.alpha]",
      "ip = \"10.0.0.1\"",
      "[[products]]",
      "name = \"Hammer\"",
      "# trailing comment without newline",
    ].join("\r\n");

    const events = await collectEvents([...toml], { comments: true });
    expect(events).toContainEqual({ name: "value", type: "string", value: "a\"b\"\"c\"\"" });
    expect(events).toContainEqual({ name: "value", type: "string", value: "a'b''c''" });
    expect(events).toContainEqual({ name: "table", path: ["server", "alpha"] });
    expect(events).toContainEqual({ name: "arrayTable", path: ["products"] });
    expect(events).toContainEqual({ name: "comment", comment: " inline comment" });
    expect(events).toContainEqual({ name: "comment", comment: " trailing comment without newline" });
  });

  test("handles 1-char chunks ending with CR in multiline strings and line-ending backslash", async () => {
    const toml = "a = \"\"\"\r\nline1\r\nline2\\\r\n  line3\"\"\"\r\nb = '''\r\nlit\r\n'''";
    const events = await collectEvents([...toml]);
    expect(events).toContainEqual({ name: "value", type: "string", value: "line1\nline2line3" });
    expect(events).toContainEqual({ name: "value", type: "string", value: "lit\n" });
  });

  test("supports skipDocument, TOMLTextToSATEventWritableStream, abort, and idempotent flush", async () => {
    const received: SATEventInterface[] = [];
    const writable = new TOMLTextToSATEventWritableStream({
      onKey: e => received.push(e),
      onValue: e => received.push(e),
    }, { skipDocument: true });
    const writer = writable.getWriter();
    await writer.write("a = 1\n");
    await writer.close();
    expect(received).toEqual([
      { name: "key", path: ["a"] },
      { name: "value", type: "integer", value: 1 },
    ]);
    expect(writable.status.pos).toBe(0);

    let abortedReason: unknown;
    const writable2 = new TOMLTextToSATEventWritableStream({
      onError: (err) => {
        abortedReason = err;
      },
    });
    const writer2 = writable2.getWriter();
    await writer2.abort("stop");
    expect(abortedReason).toBe("stop");

    // Direct parser: flush twice and enqueue after flush
    const errors: unknown[] = [];
    const parser = new TOMLTextToSATParser({
      handler: { onError: err => errors.push(err) },
    });
    parser.enqueue("x = 1");
    parser.flush();
    parser.flush();
    expect(() => parser.enqueue("y = 2")).toThrow(/Cannot enqueue after flush/);
    expect(errors.length).toBe(1);

    // Handler throwing an Error is wrapped via toErrorMessage
    const parser2 = new TOMLTextToSATParser({
      handler: {
        onKey: () => {
          throw new Error("handler boom");
        },
      },
    });
    expect(() => parser2.enqueue("a = 1\n")).toThrow(/handler boom/);
  });

  test("throws on all invalid TOML syntax cases", async () => {
    const invalidInputs = [
      "a = 1\r", // bare CR
      "a = 1\rb = 2", // bare CR followed by char
      "a = \"\"\"\r\"\"\"", // bare CR in ml basic
      "a = \"\"\"\rx\"\"\"", // bare CR in ml basic
      "a = \"\"\"\\\rx\"\"\"", // bare CR in line-ending backslash
      "a = \"\"\"\\\r\"\"\"", // bare CR at EOF in line-ending backslash
      "a = \"\"\"\\ x\"\"\"", // invalid escape after backslash + space
      "a = \"\"\"\\", // unterminated escape in ml basic
      "a = \"\"\"\"\"\"\"\"\"", // >5 quotes in ml basic
      "a = \"\"\"unterminated", // unterminated ml basic
      "a = '''\r'''", // bare CR in ml literal
      "a = '''\rx'''", // bare CR in ml literal
      "a = '''''''''", // >5 quotes in ml literal
      "a = '''unterminated", // unterminated ml literal
      "a = \"line\nbreak\"", // newline in single-line basic
      "a = \"unterminated", // unterminated basic
      "a = \"\\u12\"", // incomplete \u
      "a = \"\\uZZZZ\"", // invalid hex \u
      "a = \"\\uD800\"", // surrogate \u
      "a = \"\\q\"", // unknown escape
      "a = 'line\nbreak'", // newline in single-line literal
      "a = 'unterminated", // unterminated literal
      "a = \"", // incomplete basic
      "a = '", // incomplete literal
      "a = ", // expected value
      "a = 1 2", // unexpected char after value
      "[", // incomplete table header
      "[unclosed", // expected ']'
      "[bad!]", // invalid table close
      "[[unclosed", // expected ']]'
      "[[bad]", // expected ']]'
      "bad_key", // expected '='
      "bad_key ", // expected '='
      "bad_key !", // expected '='
      "a.", // unexpected key end
      "a = [1, 2", // unterminated array
      "a = [1 2]", // expected ',' or ']'
      "a = { x = 1", // unterminated inline table
      "a = { x", // expected '=' in inline table
      "a = { x ! 1 }", // expected '=' in inline table
      "a = { x = 1 y = 2 }", // expected ',' or '}' in inline table
      "a = not_a_valid_value", // invalid scalar
      "a = ,", // empty bare scalar
    ];

    for (const input of invalidInputs) {
      await expect(collectEvents([input]), `Input should fail: ${JSON.stringify(input)}`).rejects.toThrow();
    }

    // 1-char chunking with LF multiline strings, escapes in ml_basic, and bare CR/EOF cases
    const mlLf = [..."a = \"\"\"\nline1\\n\\\n  line2\"\"\"\nb = '''\nlit\n'''\n[ t ]\nk = 1\n"];
    const mlLfEvents = await collectEvents(mlLf);
    expect(mlLfEvents).toContainEqual({ name: "value", type: "string", value: "line1\nline2" });
    expect(mlLfEvents).toContainEqual({ name: "value", type: "string", value: "lit\n" });

    await expect(collectEvents([" ", "\r", "\n"])).resolves.toBeDefined();
    await expect(collectEvents(["[a ", "]"])).resolves.toBeDefined();
    await expect(collectEvents(["[[a]x]"])).rejects.toThrow();
    await expect(collectEvents(["=", ""])).rejects.toThrow();
    await expect(collectEvents(["k ", "=", " 1", " "])).resolves.toBeDefined();
    await expect(collectEvents(["a = { x ", "= 1 }"])).resolves.toBeDefined();
    await expect(collectEvents(["# c\narr = [\n  1, # c\n]\nnested = [[1], { a = 2 }]"])).resolves.toBeDefined();
    await expect(collectEvents(["a = \"\"\"\r"])).rejects.toThrow();
    await expect(collectEvents(["a = '''\r"])).rejects.toThrow();
    await expect(collectEvents(["a = \"\"\""])).rejects.toThrow();
    await expect(collectEvents(["a = '''"])).rejects.toThrow();
    await expect(collectEvents(["[\"a\"", "]"])).resolves.toBeDefined();
    await expect(collectEvents(["\"k\"", "=1"])).resolves.toBeDefined();
    await expect(collectEvents(["a={\"x\"", "=1}"])).resolves.toBeDefined();
    await expect(collectEvents(["a = \"1\"", " ", "\n"])).resolves.toBeDefined();
    await expect(collectEvents(["a = \"1\" # c", "\n"])).resolves.toBeDefined();
    await expect(collectEvents(["a = { \"x\"", "= 1 }"])).resolves.toBeDefined();
    await expect(collectEvents(["a = \"x\\", "n\""])).resolves.toBeDefined();
    await expect(collectEvents(["a = ", "\"\\"])).rejects.toThrow();
    await expect(collectEvents(["a = \"\"\"\\n\"\"\"", ""])).resolves.toBeDefined();
    await expect(collectEvents(["a = \"\"\"x\"\"\"\n", "b = ", "\"\\"])).rejects.toThrow();
    await expect(collectEvents(["a = \"\"\"\\\r", ""])).rejects.toThrow();
    await expect(collectEvents(["a = \"\"\"x\r", ""])).rejects.toThrow();
    await expect(collectEvents(["a = '''x\r", ""])).rejects.toThrow();
    await expect(collectEvents(["a = ", "1"])).resolves.toBeDefined();
    await expect(collectEvents(["a = ", ""])).rejects.toThrow();
    await expect(collectEvents(["a = \"\"\"\\u12", "\"\"\""])).rejects.toThrow();
    await expect(collectEvents(["a = \"\"\"", "\\", "n\"\"\""])).resolves.toBeDefined();
    await expect(collectEvents(["a = [", " ", "]"])).resolves.toBeDefined();
    await expect(collectEvents(["a = {", " ", "}"])).resolves.toBeDefined();
    await expect(collectEvents(["a = 1", "\r"])).rejects.toThrow();
    await expect(collectEvents(["a = 1979-05-27 "])).resolves.toBeDefined();
    await expect(collectEvents(["a = 1979-05-27 ", "x"])).rejects.toThrow();
  });
});
