import { describe } from "vitest";
import { assertIsDefined } from "./assertIsDefined.js";

describe.concurrent("assertIsDefined", (test) => {
  test("undefined", ({ expect }) => {
    const value: unknown = undefined;
    expect(() => assertIsDefined(value), `value is undefined. required throw`)
      .toThrow(`Value is undefined`);
  });
  test("null", ({ expect }) => {
    const value: unknown = null;
    expect(() => assertIsDefined(value), `value is null. required throw`)
      .toThrow(`Value is undefined`);
  });
  test("empty string", ({ expect }) => {
    const value: string | undefined = "";
    assertIsDefined(value);
    expect(value, `value is empty string. required no throw`)
      .toBe("");
  });
  test("string", ({ expect }) => {
    const value: string | undefined = "aaa";
    assertIsDefined(value);
    expect(value, `value is string. required no throw`)
      .toBe("aaa");
  });
});
