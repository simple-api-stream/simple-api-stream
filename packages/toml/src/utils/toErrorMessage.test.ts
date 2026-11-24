import { describe, expect, test } from "vitest";
import { toErrorMessage } from "./toErrorMessage.js";

describe("toErrorMessage", () => {
  test("returns string message as-is", () => {
    expect(toErrorMessage("simple error")).toEqual({ message: "simple error", options: undefined });
  });

  test("extracts message and sets cause when given an Error", () => {
    const err = new Error("inner");
    expect(toErrorMessage(err)).toEqual({ message: "inner", options: { cause: err } });
  });

  test("stringifies non-Error values and sets cause", () => {
    expect(toErrorMessage(404)).toEqual({ message: "404", options: { cause: 404 } });
  });
});
