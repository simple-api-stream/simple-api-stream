import { describe, expect, it } from "vitest";
import { toErrorMessage } from "./toErrorMessage.js";

describe("toErrorMessage", () => {
  it("normalizes string, Error, and non-Error values", () => {
    expect(toErrorMessage("plain")).toEqual({ message: "plain", options: undefined });
    const err = new Error("boom");
    expect(toErrorMessage(err)).toEqual({ message: "boom", options: { cause: err } });
    expect(toErrorMessage(123)).toEqual({ message: "123", options: { cause: 123 } });
  });
});
