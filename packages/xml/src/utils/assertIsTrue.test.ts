import { describe } from "vitest";
import { assertIsTrue } from "./assertIsTrue.js";

describe.concurrent("assertIsTrue", (test) => {
  test("true", ({ expect }) => {
    const value: boolean = true;
    expect(assertIsTrue(value))
      .toBeUndefined();
  });
  test("false", ({ expect }) => {
    const value: boolean = false;
    expect(() => assertIsTrue(value, "assert value is false throw"))
      .toThrow("assert value is false throw");
  });
  test("false default message", ({ expect }) => {
    const value: boolean = false;
    expect(() => assertIsTrue(value))
      .toThrow("assert is false");
  });
});
