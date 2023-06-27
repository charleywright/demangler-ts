interface ReadResult<ValueType> {
  value: ValueType;
  consumed: number;
}

/*
Read a positive integer and 
*/
type DenaryValue = ReadResult<number>;
function readDenary(str: string): DenaryValue {
  let numStr = "",
    i = 0;
  while (str[i] >= "0" && str[i] <= "9") {
    numStr += str[i];
    i++;
  }
  return { value: parseInt(numStr), consumed: i };
}

type StringValue = ReadResult<string>;
function readLengthEncoded(str: string): StringValue {
  const len = readDenary(str);
  if (isNaN(len.value)) {
    return { consumed: 0, value: "" };
  }
  str = str.substring(len.consumed);
  if (str.length < len.value) {
    return { consumed: 0, value: "" };
  }
  const value = str.substring(0, len.value);
  return { value, consumed: len.consumed + len.value };
}

// class Substitution {
//   values: string[] = [];

//   push(sub: string) {
//     this.values.push(sub);
//   }

//   pop(): string | undefined {
//     const val = this.values.pop();
//     return val;
//   }

//   count() {
//     return this.values.length;
//   }

//   /*
//     S_ is first
//     S_0 is second
//     S_1 is third
//     ...
//   */
//   get(idx: "_" | number) {
//     return idx === "_" ? this.values[0] : this.values[idx + 1];
//   }
// }

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

  M: Type.Member,
  G: Type.Imaginary,
  H: Type.Complex,
  r: Type.Restrict,
  u: Type.VendorExtendedType,
  U: Type.VendorExtendedQualifier,
  Y: Type.ExternC,

  A: Type.Array,
  z: Type.Ellipsis,
  Dp: Type.PackExpansion,
  Dt: Type.Decltype2,
  DT: Type.Decltype,
};

class Argument {
  public static parse(str: string): { arg: Argument | null; consumed: number } {
    const arg = new Argument(str);
    if (arg.type === Type.ERROR) {
      return { arg: null, consumed: 0 };
    }
    return { arg, consumed: arg.consumend };
  }

  private constructor(str: string) {
    const keys = Object.keys(TypeMapping);
    for (const key of keys) {
      if (str.startsWith(key)) {
        this.type = TypeMapping[key];
        this.consumend = key.length;
        break;
      }
    }
    if (this.type === Type.ERROR) {
      const type = readLengthEncoded(str);
      if (type.consumed > 0) {
        this.rawType = type.value;
        this.type = Type.RAW;
        this.consumend = type.consumed;
      }
    }
  }

  private child: Argument | null = null;
  private qualifiers: Qualifier[] = [];
  private type: Type = Type.ERROR;
  private consumend: number = 0;
  private rawType: string = "";

  public toString(): string {
    if (this.type === Type.RAW) {
      return this.rawType;
    }
    return this.type;
  }
}

enum Qualifier {
  Pointer = "*", // P
  Const = "const", // K
  Volatile = "volatile", // V
  Reference = "&", // R
  RValueReference = "&&", // O
}

// enum AbreviationTypes {
//   StdAllocator = "std::allocator", // Sa
//   StdBasicString = "std::basic_string", // Sb
//   StdIOStream = "std::basic_iostream<char,std::char_traits<char>>", // Sd
//   StdIStream = "std::basic_istream<char,std::char_traits<char>>", // Si
//   StdOStream = "std::basic_ostream<char,std::char_traits<char>>", // So
//   StdString = "std::basic_string<char,std::char_traits<char>,std::allocator<char>>", // Ss
// }
// const AbreviationTypesMapping: { [k: string]: AbreviationTypes } = {
//   Sa: AbreviationTypes.StdAllocator,
//   Sb: AbreviationTypes.StdBasicString,
//   Sd: AbreviationTypes.StdIOStream,
//   Si: AbreviationTypes.StdIStream,
//   So: AbreviationTypes.StdOStream,
//   Ss: AbreviationTypes.StdString,
// };

export function isMangled(symbol: string) {
  return symbol.startsWith("_Z") || symbol.startsWith("__Z");
}

export function demangle(input: string): string {
  if (!isMangled(input)) {
    return input;
  }
  let symbol = input.substring(input.indexOf("Z") + 1).replace(/ /g, "");

  const isVarConst = symbol[0] === "L"; // void(* const baz)(int) = nullptr; = _ZL3baz
  if (isVarConst) symbol = symbol.substring(1);

  const qualifiers: Qualifier[] = [];
  const namespaceParts: string[] = [];
  let name: string = "";

  if (symbol.startsWith("K")) {
    qualifiers.push(Qualifier.Const);
    symbol = symbol.substring(1);
  }

  // Namespacing active
  const isNamespaceEscaped = symbol[0] === "N";
  const isInStdNamespace = symbol.startsWith("St");
  if (isNamespaceEscaped || isInStdNamespace) {
    if (isNamespaceEscaped) symbol = symbol.substring(1);
    if (symbol.startsWith("K")) {
      qualifiers.push(Qualifier.Const);
      symbol = symbol.substring(1);
    }

    while (symbol.length > 0) {
      if (symbol.startsWith("St")) {
        symbol = symbol.substring(2);
        namespaceParts.push("std");
        continue; // std::std:: is cursed but valid. Would it be mangled like that though?
      }
      const part = readLengthEncoded(symbol);
      if (part.consumed === 0) {
        break;
      }
      namespaceParts.push(part.value);
      symbol = symbol.substring(part.consumed);
    }

    if (isNamespaceEscaped) {
      if (symbol[0] !== "E" || namespaceParts.length === 0) {
        return input;
      }
      symbol = symbol.substring(1);
    }

    name = namespaceParts.pop() as string; // Check above for length, so cannot return undefined
  } else {
    const namePart = readLengthEncoded(symbol);
    if (namePart.consumed === 0) {
      return input;
    }
    name = namePart.value;
    symbol = symbol.substring(namePart.consumed);
  }

  // Variable
  if (symbol.length === 0) {
    let demangled = isVarConst ? "const " : "";
    for (const part of namespaceParts) {
      demangled += part + "::";
    }
    demangled += name;
    return demangled;
  }

  let argumentTypes: Argument[] = [];
  while (symbol.length > 0) {
    const { arg, consumed } = Argument.parse(symbol);
    if (consumed === 0 || arg === null) {
      /*
        We've tried to parse the arguments, and encountered something that's not an argument
        If we're not at the end of the string then we've reached an argument we can't parse
      */
      return input;
    }
    argumentTypes.push(arg);
    symbol = symbol.substring(consumed);
  }

  let demangled = "";
  for (const part of namespaceParts) {
    demangled += part + "::";
  }
  demangled += name + "(";
  demangled += argumentTypes.join(",");
  demangled += ")";
  for (const qualifier of qualifiers) {
    demangled += " " + qualifier;
  }
  return demangled;
}
