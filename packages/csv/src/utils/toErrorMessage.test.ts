import { describe, expect, it } from "vitest";
import { toErrorMessage } from "./toErrorMessage.js";

describe("toErrorMessage", () => {
  it("returns string message as-is", () => {
    expect(toErrorMessage("msg")).toEqual({ message: "msg", options: undefined });
  });

  it("extracts message and sets cause when given an Error", () => {
    const err = new Error("inner");
    expect(toErrorMessage(err)).toEqual({ message: "inner", options: { cause: err } });
  });

  it("stringifies non-Error values and sets cause", () => {
    expect(toErrorMessage(123)).toEqual({ message: "123", options: { cause: 123 } });
  });
});
