export function demangle(mangled: string) {
  return new MangledSymbol(mangled).demangle().toString();
}

export function isMangled(mangled: string) {
  return mangled.startsWith("_Z") || mangled.startsWith("__Z");
}

export class MangledSymbol {
  public constructor(mangled: string) {
    this.mangled = mangled;
    this.demangled = mangled;
  }

  private mangled: string = "";
  private demangled: string = "";
  private error: string = "";
  private parts: Part[] = [];
  private vendorSuffix: string = "";
  /*
    Function arguments come after closing E in namespaced
    Otherwise they are directly after first name part
    which can be a template: _Z4funcIiEvT_ func<int>(int)
  */

  public demangle(): MangledSymbol {
    let offset = 0;
    if (this.mangled.startsWith("_Z")) {
      offset += 2;
    } else if (this.mangled.startsWith("__Z")) {
      offset += 3;
    } else {
      return this;
    }

    while (offset < this.mangled.length) {
      if (this.mangled[offset] === "L") {
        offset += 1;
        continue;
      } else {
        break;
      }
    }

    const nameParts = parseNameParts(this.mangled, offset);
    if (nameParts.error) {
      this.error = nameParts.error;
      return this;
    }
    this.parts.push(...nameParts.parts);
    offset += nameParts.consumed;

    if (this.parts.length === 0) {
      this.error = "No name parts";
      return this;
    }

    if (offset < this.mangled.length) {
      const functionPart = FunctionPart.parse(this.mangled, offset);
      if (functionPart.error) {
        this.error = functionPart.error;
        return this;
      }
      if (functionPart.consumed > 0) {
        this.parts.push(functionPart.value);
        offset += functionPart.consumed;
      }
    }

    if (this.mangled[offset] === ".") {
      this.vendorSuffix = this.mangled.substring(offset + 1);
      offset = this.mangled.length;
    }

    if (offset != this.mangled.length) {
      this.error = `Incomplete parse: '${this.mangled.substring(offset)}'`;
      return this;
    }

    this.demangled = "";
    for (const part of this.parts) {
      if (part instanceof NamePart) {
        this.demangled += "::" + part.toString();
      } else {
        this.demangled += part.toString();
      }
    }
    if (this.demangled.startsWith("::")) {
      this.demangled = this.demangled.substring(2);
    }

    return this;
  }

  public getError(): string {
    return this.error;
  }

  public getVendorSuffix(): string {
    return this.vendorSuffix;
  }

  public toString(): string {
    return this.demangled;
  }
}

// TODO: Can we use generics instead of any?
interface ParseResult {
  value: any | null;
  consumed: number;
  error?: string;
}
interface ReadResult<Type> {
  value: Type | null;
  consumed: number;
}

class Part {
  public static parse(str: string, offset: number = 0): ParseResult {
    return { value: null, consumed: 0, error: "Base class cannot parse" };
  }

  private constructor(str: string, offset: number) {}

  public toString(): string {
    return "part";
  }
}

// Length denoted string e.g. 3foo
class NamePart implements Part {
  public static parse(str: string, offset: number = 0): ParseResult {
    const part = new NamePart(str, offset);
    if (!part.error) {
      return { value: part, consumed: part.consumed };
    }
    return { value: null, consumed: 0, error: part.error };
  }
  public static raw(str: string): NamePart {
    return new NamePart(str, 0, true);
  }

  private readLength(str: string, offset: number): boolean {
    let numStr = "";
    while (
      str[offset + this.consumed] >= "0" &&
      str[offset + this.consumed] <= "9"
    ) {
      numStr += str[offset + this.consumed];
      this.consumed++;
    }
    this.length = parseInt(numStr);
    return !isNaN(this.length);
  }

  private constructor(str: string, offset: number, raw: boolean = false) {
    if (raw) {
      if (offset) {
        this.str = str.substring(offset);
      } else {
        this.str = str;
      }
      this.length = this.str.length;
      return;
    }

    if (!this.readLength(str, offset)) {
      return;
    }
    if (
      str.length - offset - this.consumed < this.length ||
      this.length === 0
    ) {
      this.error = "NamePart: Name too short";
      return;
    }
    offset += this.consumed;
    this.str = str.substring(offset, offset + this.length);
    this.consumed += this.str.length;
  }

  private consumed: number = 0;
  private error: string = "";
  private length: number = 0;
  private str: string = "";

  public toString(): string {
    return this.str;
  }
}

function parseNameParts(
  str: string,
  offset: number
): { consumed: number; parts: NamePart[]; error?: string } {
  let consumed = 0;
  let parts: NamePart[] = [];
  const scoped = str[offset + consumed] === "N";
  let scopeTerminated = !scoped;
  if (scoped) {
    consumed += 1;
  }
  while (offset + consumed < str.length) {
    if (str[offset + consumed] === "S") {
      // TODO: Use TemplatePart instead of hardcoded strings?
      switch (str[offset + consumed + 1]) {
        case "t":
          parts.push(NamePart.raw("std"));
          consumed += 2;
          continue;
        case "a":
          parts.push(NamePart.raw("std"));
          parts.push(NamePart.raw("allocator"));
          consumed += 2;
          continue;
        case "b":
          parts.push(NamePart.raw("std"));
          parts.push(NamePart.raw("basic_string"));
          consumed += 2;
          continue;
        case "s":
          parts.push(NamePart.raw("std"));
          parts.push(
            NamePart.raw(
              "basic_string<char,std::char_traits<char>,std::allocator<char>>"
            )
          );
          consumed += 2;
          continue;
        case "i":
          parts.push(
            NamePart.raw("std::basic_istream<char,std::char_traits<char>>")
          );
          consumed += 2;
          continue;
        case "o":
          parts.push(
            NamePart.raw("std::basic_ostream<char,std::char_traits<char>>")
          );
          consumed += 2;
          continue;
        case "d":
          parts.push(
            NamePart.raw("std::basic_iostream<char,std::char_traits<char>>")
          );
          consumed += 2;
        default:
          break;
      }
    }
    const part = NamePart.parse(str, offset + consumed);
    if (part.error) {
      return { consumed: 0, parts: [], error: part.error };
    }
    if (part.consumed === 0) {
      if (scoped && str[offset + consumed] === "E") {
        scopeTerminated = true;
        consumed += 1;
      }
      break;
    }
    parts.push(part.value);
    consumed += part.consumed;
  }
  if (!scopeTerminated) {
    return { consumed: 0, parts: [], error: "NamePart: Unterminated scope" };
  }
  return { consumed, parts };
}

// https://itanium-cxx-abi.github.io/cxx-abi/abi-mangling.html
enum Type {
  Void = "void", // v
  Bool = "bool", // b
  Char = "char", // c
  SChar = "signed char", // a
  UChar = "unsigned char", // h
  WChar = "wchar_t", // w
  Short = "short", // s
  UShort = "unsigned short", // t
  Int = "int", // i
  UInt = "unsigned int", // j
  Long = "long", // l
  ULong = "unsigned long", // m
  LongLong = "long long", // x
  ULongLong = "unsigned long long", // y
  Int128 = "__int128", // n
  UInt128 = "unsigned __int128", // o
  Float = "float", // f
  Double = "double", // d
  LongDouble = "long double", // e
  Float128 = "__float128", // g
  Pointer = "*", // P
  Reference = "&", // R
  RValueReference = "&&", // O

  Member = "member", // TODO: Not sure when this is used, id is "M"
  Imaginary = "imaginary", // TODO: Research "imaginary type qualifier (C 2000)". id is "G"
  Complex = "complex", // TODO: Research "complex type qualifier (C 2000)". id is "H"
  Restrict = "restrict", // TODO: Research "restrict qualifier (C 2000)". id is "r"
  VendorExtendedType = "vendor-extended-type", // TODO: Research "vendor extended builtin type". id is "u"
  VendorExtendedQualifier = "vendor-extended-qualifier", // TODO: Research "vendor extended type qualifier". id is "U"
  ExternC = "extern-c", // TODO: When is this used in name mangling? id is "Y"

  Array = "array", // A
  Ellipsis = "...", // z
  PackExpansion = "...T", // Dp
  Decltype2 = "decltype2", // Dt
  Decltype = "decltype", // DT

  ERROR = "error",
  RAW = "raw",
}
const TypeMapping: { [k: string]: Type } = {
  v: Type.Void,
  b: Type.Bool,
  c: Type.Char,
  a: Type.SChar,
  h: Type.UChar,
  w: Type.WChar,
  s: Type.Short,
  t: Type.UShort,
  i: Type.Int,
  j: Type.UInt,
  l: Type.Long,
  m: Type.ULong,
  x: Type.LongLong,
  y: Type.ULongLong,
  n: Type.Int128,
  o: Type.UInt128,
  f: Type.Float,
  d: Type.Double,
  e: Type.LongDouble,
  g: Type.Float128,
  P: Type.Pointer,
  R: Type.Reference,
  O: Type.RValueReference,

  M: Type.Member,
  G: Type.Imaginary,
  H: Type.Complex,
  u: Type.VendorExtendedType,
  U: Type.VendorExtendedQualifier,
  Y: Type.ExternC,

  A: Type.Array,
  z: Type.Ellipsis,
  Dp: Type.PackExpansion,
  Dt: Type.Decltype2,
  DT: Type.Decltype,
};

// Function arguments
class FunctionPart implements Part {
  public static parse(str: string, offset: number): ParseResult {
    const part = new FunctionPart(str, offset);
    if (!part.error) {
      return { value: part, consumed: part.consumed };
    }
    return { value: part, consumed: 0, error: part.error };
  }

  private constructor(str: string, offset: number) {}

  private consumed: number = 0;
  private error: string = "";
  private str: string = "";

  public toString(): string {
    return this.str;
  }
}
