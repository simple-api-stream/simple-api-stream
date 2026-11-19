import { describe } from "vitest";
import { escape } from "./index.js";

describe.concurrent("escape", (test) => {
  test("null", ({ expect }) => {
    const value = null;
    expect(escape(value)).toEqual("");
  });
  test("undefined", ({ expect }) => {
    const value = undefined;
    expect(escape(value)).toEqual("");
  });
  test("empty", ({ expect }) => {
    const value = "";
    expect(escape(value)).toEqual("");
  });
  test("& -> &amp;", ({ expect }) => {
    const value = "&";
    expect(escape(value)).toEqual("&amp;");
  });
});
