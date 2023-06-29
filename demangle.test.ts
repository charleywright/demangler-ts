import { describe, expect, test } from "@jest/globals";
import { isMangled, demangle, MangledSymbol } from "./demangle";

function demangleWithError(mangled: string): string {
  const symbol = new MangledSymbol(mangled);
  symbol.demangle();
  const err = symbol.getError();
  return err ? err : symbol.toString();
}

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
    expect(demangle("_ZL3bar")).toBe("bar");
  });
  test("variables with namespaces", () => {
    expect(demangle("_ZN1a3barE")).toBe("a::bar");
    expect(demangle("_ZSt3bar")).toBe("std::bar");
    expect(demangle("_ZN4foo14bar2E")).toBe("foo1::bar2");
    expect(demangle("_ZN4foo14bar2")).toBe("_ZN4foo14bar2");
  });
});

// describe("parse functions", () => {
//   test("simple functions", () => {
//     expect(demangle("_Z3foov")).toBe("foo(void)");
//     expect(demangle("_Z3foobcahwstijlmxynofdeg")).toBe(
//       "foo(bool, char, signed char, unsigned char, wchar_t, short, unsigned short, int, unsigned int, long, unsigned long, long long, unsigned long long, __int128, unsigned __int128, float, double, long double, __float128)"
//     );
//     expect(demangle("_Z3fooB")).toBe("_Z3fooB");
//     expect(demangle("_Z3foo3bar")).toBe("foo(bar)");
//     expect(demangle("_Z3foo4bar")).toBe("_Z3foo4bar");
//     expect(demangle("_ZLN4foo14bar2E3baz")).toBe("foo1::bar2(baz)");
//     expect(demangle("_ZNK4foo14bar2E3baz")).toBe("foo1::bar2(baz) const");
//     expect(demangle("_ZLN4foo14bar2EN3baz3quxE")).toBe("foo1::bar2(baz::qux)");
//     expect(demangle("_Z3fooiB")).toBe("_Z3fooiB");
//     expect(demangle("_ZK3fooi")).toBe("foo(int) const");
//     expect(demangle("_ZN1a1S3fooEv")).toBe("a::S::foo(void)");
//     expect(demangle("_ZNK1a1S9const_fooEv")).toBe(
//       "a::S::const_foo(void) const"
//     );
//   });
//   test("arguments with qualifiers", () => {
//     expect(demangle("_Z3fooP3bar")).toBe("foo(bar*)");
//     expect(demangle("_Z3fooPKPPPKPK3bar")).toBe(
//       "foo(bar const* const*** const*)"
//     );
//     expect(demangle("_Z3fooR3bar")).toBe("foo(bar&)");
//     expect(demangle("_Z3fooK3bar")).toBe("foo(bar const)");
//     expect(demangle("_Z3fooPK3bar")).toBe("foo(bar const*)");
//     expect(demangle("_Z3fooKP3bar")).toBe("foo(bar* const)");
//     expect(demangle("_Z3fooV3bar")).toBe("foo(bar volatile)");
//     expect(demangle("_Z3fooPKiPi")).toBe("foo(int const*, int*)");
//     expect(demangle("_Z3fooKV3bar")).toBe("foo(bar volatile const)");
//     expect(demangle("_Z3fooPP3bar")).toBe("foo(bar**)");
//     expect(demangle("_Z3fooRPi")).toBe("foo(int*&)");
//     expect(demangle("_Z3fooPRi")).toBe("_Z3fooPRi"); // C++ doesn't allow this. c++filt however produces foo(int&*)
//     expect(demangle("_Z3fooOPi")).toBe("foo(int*&&)");
//     expect(demangle("_Z3fooPOi")).toBe("_Z3fooPOi"); // Again, c++ doesn't allow this, but c++filt produces foo(int&&*)
//     expect(demangle("_Z3fooORi")).toBe("_Z3fooORi"); // c++filt gives foo(int&)
//     expect(demangle("_Z3fooROi")).toBe("_Z3fooROi"); // Again, c++filt gives foo(int&)
//     expect(demangle("_Z3fooOORi")).toBe("_Z3fooOORi"); // c++filt gives foo(int&&&)
//     expect(demangle("_Z3fooROOi")).toBe("_Z3fooROOi"); // Again, c++filt gives foo(int&&&)
//     expect(demangle("_Z3fooRQ")).toBe("_Z3fooRQ");
//     expect(demangle("_Z3fooOQ")).toBe("_Z3fooOQ");
//     expect(demangle("_Z3fooPN3bar3bazE")).toBe("foo(bar::baz*)");
//     expect(demangle("_Z3fooKPN3bar3bazE")).toBe("foo(bar::baz* const)");
//     expect(demangle("_Z3fooKPKN3bar3bazE")).toBe("foo(bar::baz const* const)");
//   });
//   test("functions with templates", () => {
//     expect(demangle("_Z3fooIiEvT_")).toBe("void foo<int>(int)");
//     expect(
//       demangle(
//         "_ZN2ns7myclassINSt7__cxx1112basic_stringIcSt11char_traitsIcESaIcEEEE11member_funcIiEEvT_"
//       )
//     ).toBe(""); // void ns::myclass<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > >::member_func<int>(int)
//   });
// });
