import { describe, expect, test } from "@jest/globals";
import { isMangled, demangle } from "./demangle";

describe("presence of name mangling can be detected", () => {
  test("c functions don't have mangling", () => {
    expect(isMangled("f")).toStrictEqual(false);
  });
  test("c++ functions do have mangling", () => {
    expect(isMangled("_Z1fv")).toStrictEqual(true);
    expect(isMangled("__Z1fv")).toStrictEqual(true);
  });
});

describe("parse variables", () => {
  test("simple variables", () => {
    expect(demangle("bar")).toBe("bar");
    expect(demangle("_Z3bar")).toBe("bar");
  });
  test("variables with modifiers", () => {
    expect(demangle("_ZL3bar")).toBe("const bar");
  });
  test("variables with namespaces", () => {
    expect(demangle("_ZN1a3barE")).toBe("a::bar");
    expect(demangle("_ZSt3bar")).toBe("std::bar");
  });
});
