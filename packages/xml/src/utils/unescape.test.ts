import { describe } from "vitest";
import { unescape } from "./index.js";

describe.concurrent("unescape", (test) => {
  test("null", ({ expect }) => {
    const value = null;
    expect(unescape(value)).toEqual("");
  });
  test("undefined", ({ expect }) => {
    const value = undefined;
    expect(unescape(value)).toEqual("");
  });
  test("empty", ({ expect }) => {
    const value = "";
    expect(unescape(value)).toEqual("");
  });
  test("recorized: &amp; -> &", ({ expect }) => {
    const value = "&amp;";
    expect(unescape(value)).toEqual("&");
  });
  test("x10: &#8482; -> ™", ({ expect }) => {
    const value = "&#8482;";
    expect(unescape(value)).toEqual("™");
  });
  test("x16: &#x21; -> !", ({ expect }) => {
    const value = "&#x21;";
    expect(unescape(value)).toEqual("!");
  });
  test("not recorized: &hoge; -> &hoge;", ({ expect }) => {
    const value = "&hoge;";
    expect(unescape(value)).toEqual("&hoge;");
  });
  test("prototype properties are not resolved", ({ expect }) => {
    expect(unescape("&toString;")).toEqual("&toString;");
    expect(unescape("&constructor;")).toEqual("&constructor;");
    expect(unescape("&valueOf;")).toEqual("&valueOf;");
    expect(unescape("&__proto__;")).toEqual("&__proto__;");
  });
  test("invalid or out-of-range numeric character references do not throw", ({ expect }) => {
    expect(unescape("&#abc;")).toEqual("&#abc;");
    expect(unescape("&#123abc;")).toEqual("&#123abc;");
    expect(unescape("&#xZZ;")).toEqual("&#xZZ;");
    expect(unescape("&#x12g;")).toEqual("&#x12g;");
    expect(unescape("&#99999999;")).toEqual("&#99999999;");
    expect(unescape("&#x110000;")).toEqual("&#x110000;");
    expect(unescape("&#x1F600;")).toEqual("😀");
  });
});
