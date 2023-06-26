import { describe, expect, test } from "@jest/globals";
import {
  isMangled,
  demangle,
  __EXPORTED_FOR_TESTING_DONT_USE,
} from "./demangle";
const { readDenary: _readDenary } = __EXPORTED_FOR_TESTING_DONT_USE;

/*
Examples of mangled symbols come from here - https://itanium-cxx-abi.github.io/cxx-abi/abi-examples.html#mangling
and various libraries used in the Apple Music android app
*/

describe("denary values are parsed properly", () => {
  test("leading zeroes increase length", () => {
    expect(_readDenary("000001")).toStrictEqual({ value: 1, length: 6 });
  });
});

describe("presence of name mangling can be detected", () => {
  test("c functions don't have mangling", () => {
    expect(isMangled("f")).toStrictEqual(false);
    expect(demangle("f")).toStrictEqual("f");
  });
  test("c++ functions do have mangling", () => {
    expect(isMangled("_Z1fv")).toStrictEqual(true);
    expect(demangle("_Z1fv")).toStrictEqual("f(void)");
  });
});

describe("parse function names correctly", () => {
  test("global functions", () => {
    expect(demangle("_Z2f")).toStrictEqual("_Z2f");
    expect(demangle("_Z5qrandv")).toBe("qrand(void)");
  });
  test("namespaced functions", () => {});
});
