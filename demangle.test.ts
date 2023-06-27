import { describe, expect, test } from "@jest/globals";
import { isMangled, demangle } from "./demangle";

describe("presence of name mangling can be detected", () => {
  test("c functions don't have mangling", () => {
    expect(isMangled("f")).toBe(false);
  });
  test("c++ functions do have mangling", () => {
    expect(isMangled("_Z1fv")).toBe(true);
    expect(isMangled("__Z1fv")).toBe(true);
  });
});

describe("parse variables", () => {
  test("simple variables", () => {
    expect(demangle("bar")).toBe("bar");
    expect(demangle("_Z3bar")).toBe("bar");
    expect(demangle("_Z4foo")).toBe("_Z4foo");
  });
  test("variables with modifiers", () => {
    expect(demangle("_ZL3bar")).toBe("const bar");
  });
  test("variables with namespaces", () => {
    expect(demangle("_ZN1a3barE")).toBe("a::bar");
    expect(demangle("_ZSt3bar")).toBe("std::bar");
    expect(demangle("_Z1a3bar")).toBe("_Z1a3bar");
    expect(demangle("_Z3foo4bar")).toBe("_Z3foo4bar");
    expect(demangle("_ZN4foo14bar2E")).toBe("foo1::bar2");
  });
});

describe("parse functions", () => {
  test("simple functions", () => {
    expect(demangle("_Z3foov")).toBe("foo(void)");
    expect(demangle("_Z3foobcahwstijlmxynofdeg")).toBe(
      "foo(bool,char,signed char,unsigned char,wchar_t,short,unsigned short,int,unsigned int,long,unsigned long,long long,unsigned long long,__int128,unsigned __int128,float,double,long double,__float128)"
    );
    expect(demangle("_Z3fooB")).toBe("_Z3fooB");
    expect(demangle("_Z3fooiB")).toBe("foo(int)"); // TODO: This is somewhat wrong, can we detect this?
  });
});
