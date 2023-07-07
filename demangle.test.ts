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
    expect(demangleWithError("bar")).toBe("bar");
    expect(demangleWithError("_Z3bar")).toBe("bar");
    expect(demangle("_Z4foo")).toBe("_Z4foo");
  });
  test("variables with modifiers", () => {
    expect(demangleWithError("_ZL3bar")).toBe("bar const");
    expect(demangleWithError("_ZN3fooL3barE")).toBe("foo::bar const");
  });
  test("variables with namespaces", () => {
    expect(demangleWithError("_ZN1a3barE")).toBe("a::bar");
    expect(demangleWithError("_ZSt3bar")).toBe("std::bar");
    expect(demangleWithError("_ZN4foo14bar2E")).toBe("foo1::bar2");
    expect(demangle("_ZN4foo14bar2")).toBe("_ZN4foo14bar2");
    expect(demangle("_ZSt3barE")).toBe("_ZSt3barE");
  });
  test("vendor string", () => {
    expect(new MangledSymbol("_Z3foo.bar").demangle().getVendorSuffix()).toBe(
      "bar"
    );
    expect(
      new MangledSymbol("_Z3foo._Z3\x12foo").demangle().getVendorSuffix()
    ).toBe("_Z3\x12foo");
  });
});

describe("parse functions", () => {
  test("simple functions", () => {
    expect(demangleWithError("_Z3foov")).toBe("foo(void)");
    expect(demangleWithError("_Z3foobcahwstijlmxynofdeg")).toBe(
      "foo(bool, char, signed char, unsigned char, wchar_t, short, unsigned short, int, unsigned int, long, unsigned long, long long, unsigned long long, __int128, unsigned __int128, float, double, long double, __float128)"
    );
    expect(demangle("_Z3fooB")).toBe("_Z3fooB");
    expect(demangleWithError("_Z3foo3bar")).toBe("foo(bar)");
    expect(demangle("_Z3foo4bar")).toBe("_Z3foo4bar");
    expect(demangleWithError("_ZLN4foo14bar2E3baz")).toBe("foo1::bar2(baz)");
    expect(demangleWithError("_ZNK4foo14bar2E3baz")).toBe(
      "foo1::bar2(baz) const"
    );
    expect(demangleWithError("_ZLN4foo14bar2EN3baz3quxE")).toBe(
      "foo1::bar2(baz::qux)"
    );
    expect(demangleWithError("_Z3fooiB")).toBe("_Z3fooiB");
    expect(demangleWithError("_ZK3fooi")).toBe("foo(int) const");
    expect(demangleWithError("_ZN1a1S3fooEv")).toBe("a::S::foo(void)");
    expect(demangleWithError("_ZNK1a1S9const_fooEv")).toBe(
      "a::S::const_foo(void) const"
    );
  });
  //   test("arguments with qualifiers", () => {
  //     expect(demangleWithError("_Z3fooP3bar")).toBe("foo(bar*)");
  //     expect(demangleWithError("_Z3fooPKPPPKPK3bar")).toBe(
  //       "foo(bar const* const*** const*)"
  //     );
  //     expect(demangleWithError("_Z3fooR3bar")).toBe("foo(bar&)");
  //     expect(demangleWithError("_Z3fooK3bar")).toBe("foo(bar const)");
  //     expect(demangleWithError("_Z3fooPK3bar")).toBe("foo(bar const*)");
  //     expect(demangleWithError("_Z3fooKP3bar")).toBe("foo(bar* const)");
  //     expect(demangleWithError("_Z3fooV3bar")).toBe("foo(bar volatile)");
  //     expect(demangleWithError("_Z3fooPKiPi")).toBe("foo(int const*, int*)");
  //     expect(demangleWithError("_Z3fooKV3bar")).toBe("foo(bar volatile const)");
  //     expect(demangleWithError("_Z3fooPP3bar")).toBe("foo(bar**)");
  //     expect(demangleWithError("_Z3fooRPi")).toBe("foo(int*&)");
  //     expect(demangleWithError("_Z3fooPRi")).toBe("_Z3fooPRi"); // C++ doesn't allow this. c++filt however produces foo(int&*)
  //     expect(demangleWithError("_Z3fooOPi")).toBe("foo(int*&&)");
  //     expect(demangleWithError("_Z3fooPOi")).toBe("_Z3fooPOi"); // Again, c++ doesn't allow this, but c++filt produces foo(int&&*)
  //     expect(demangleWithError("_Z3fooORi")).toBe("_Z3fooORi"); // c++filt gives foo(int&)
  //     expect(demangleWithError("_Z3fooROi")).toBe("_Z3fooROi"); // Again, c++filt gives foo(int&)
  //     expect(demangleWithError("_Z3fooOORi")).toBe("_Z3fooOORi"); // c++filt gives foo(int&&&)
  //     expect(demangleWithError("_Z3fooROOi")).toBe("_Z3fooROOi"); // Again, c++filt gives foo(int&&&)
  //     expect(demangleWithError("_Z3fooRQ")).toBe("_Z3fooRQ");
  //     expect(demangleWithError("_Z3fooOQ")).toBe("_Z3fooOQ");
  //     expect(demangleWithError("_Z3fooPN3bar3bazE")).toBe("foo(bar::baz*)");
  //     expect(demangleWithError("_Z3fooKPN3bar3bazE")).toBe("foo(bar::baz* const)");
  //     expect(demangleWithError("_Z3fooKPKN3bar3bazE")).toBe("foo(bar::baz const* const)");
  //   });
  //   test("functions with templates", () => {
  //     expect(demangleWithError("_Z3fooIiEvT_")).toBe("void foo<int>(int)");
  //     expect(
  //       demangleWithError(
  //         "_ZN2ns7myclassINSt7__cxx1112basic_stringIcSt11char_traitsIcESaIcEEEE11member_funcIiEEvT_"
  //       )
  //     ).toBe(""); // void ns::myclass<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > >::member_func<int>(int)
  //   });
});
