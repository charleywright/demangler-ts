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

type LengthEncoded = ReadResult<string>;
function readLengthEncoded(str: string): LengthEncoded {
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

type NamespacedStringValue = ReadResult<Array<string>>;
function readNamespacedString(str: string): NamespacedStringValue {
  let ret: NamespacedStringValue = { consumed: 0, value: [] };
  const isNamespaceEscaped = str[0] === "N";
  const isInStdNamespace = str.startsWith("St");
  if (isNamespaceEscaped || isInStdNamespace) {
    if (isNamespaceEscaped) {
      str = str.substring(1);
      ret.consumed += 1;
    }

    while (str.length > 0) {
      if (str.startsWith("St")) {
        str = str.substring(2);
        ret.consumed += 2;
        ret.value.push("std");
        continue; // std::std:: is cursed but valid. Would it be mangled like that though?
      }
      const part = readLengthEncoded(str);
      if (part.consumed === 0) {
        break;
      }
      ret.value.push(part.value);
      str = str.substring(part.consumed);
      ret.consumed += part.consumed;
    }

    if (isNamespaceEscaped) {
      if (str[0] !== "E" || ret.value.length === 0) {
        ret.consumed = 0;
        return ret;
      }
      str = str.substring(1);
      ret.consumed += 1;
    }

    return ret;
  }
  const namePart = readLengthEncoded(str);
  if (namePart.consumed > 0) {
    ret.value.push(namePart.value);
    ret.consumed += namePart.consumed;
  }
  return ret;
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

class Argument {
  public static parse(str: string): { arg: Argument | null; consumed: number } {
    const arg = new Argument(str);
    if (arg.type === Type.ERROR) {
      return { arg: null, consumed: 0 };
    }
    return { arg, consumed: arg.consumed };
  }

  private constructor(str: string, parent = Type.ERROR) {
    if (str[0] === "K") {
      this.isConst = true;
      str = str.substring(1);
      this.consumed += 1;
    }
    if (str[0] === "V") {
      this.isVolatile = true;
      str = str.substring(1);
      this.consumed += 1;
    }

    if (str[0] === "P") {
      str = str.substring(1);
      this.consumed += 1;
      this.child = new Argument(str, Type.Pointer);
      if (this.child.type === Type.ERROR) {
        return;
      }
      this.consumed += this.child.consumed;
      this.type = Type.Pointer;
      return;
    }
    if (str[0] === "R") {
      if (
        parent === Type.Pointer ||
        parent === Type.Reference ||
        parent === Type.RValueReference
      ) {
        return;
      }
      str = str.substring(1);
      this.consumed += 1;
      this.child = new Argument(str, Type.Reference);
      if (this.child.type === Type.ERROR) {
        return;
      }
      this.consumed += this.child.consumed;
      this.type = Type.Reference;
      return;
    }
    if (str[0] === "O") {
      if (
        parent === Type.Pointer ||
        parent === Type.Reference ||
        parent === Type.RValueReference
      ) {
        return;
      }
      str = str.substring(1);
      this.consumed += 1;
      this.child = new Argument(str, Type.RValueReference);
      if (this.child.type === Type.ERROR) {
        return;
      }
      this.consumed += this.child.consumed;
      this.type = Type.RValueReference;
      return;
    }

    const keys = Object.keys(TypeMapping);
    for (const key of keys) {
      if (str.startsWith(key)) {
        this.type = TypeMapping[key];
        this.consumed += key.length;
        break;
      }
    }
    if (this.type === Type.ERROR) {
      const namespacedString = readNamespacedString(str);
      if (namespacedString.consumed > 0) {
        this.type = Type.RAW;
        this.rawTypeStr = namespacedString.value.join("::");
        this.consumed += namespacedString.consumed;
      }
    }
  }

  private child: Argument | null = null;
  private type: Type = Type.ERROR;
  private consumed: number = 0;
  private rawTypeStr: string = "";

  private isConst = false;
  private isVolatile = false;

  public toString(): string {
    let str = "";
    if (this.child !== null) {
      str += this.child.toString(); // Is recursion the best strategy?
    }
    if (this.type === Type.RAW) {
      str += this.rawTypeStr;
    } else {
      str += this.type;
    }
    if (this.isVolatile) {
      str += " volatile";
    }
    if (this.isConst) {
      str += " const";
    }
    return str;
  }
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

  let isRetConst = false;
  if (symbol.startsWith("K")) {
    isRetConst = true;
    symbol = symbol.substring(1);
  }
  if (symbol.startsWith("NK")) {
    isRetConst = true;
    symbol = "N" + symbol.substring(2);
  }

  const namespaceParts = readNamespacedString(symbol);
  if (namespaceParts.consumed === 0) {
    return input;
  }
  symbol = symbol.substring(namespaceParts.consumed);
  const name = namespaceParts.value.pop() as string;

  // Variable
  if (symbol.length === 0) {
    let demangled = isVarConst ? "const " : "";
    for (const part of namespaceParts.value) {
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
  for (const part of namespaceParts.value) {
    demangled += part + "::";
  }
  demangled += name + "(";
  demangled += argumentTypes.join(", ");
  demangled += ")";
  if (isRetConst) demangled += " const";
  return demangled;
}
