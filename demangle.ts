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
  private name: UnscopedNamePart | ScopedNamePart | null = null;
  private func: FunctionPart | null = null;
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

    const namePart = parseNamePart(this.mangled, offset);
    if (namePart.error) {
      this.error = namePart.error;
      return this;
    }
    if (namePart.consumed === 0) {
      this.error = "Failed to read name";
      return this;
    }
    this.name = namePart.value;
    offset += namePart.consumed;

    // CodeCoverage: namePart.error would've been set, therefore this is always false
    if (this.name === null) {
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
        this.func = functionPart.value;
        offset += functionPart.consumed;
      }
    }

    if (this.mangled[offset] === ".") {
      this.vendorSuffix = this.mangled.substring(offset + 1);
      offset = this.mangled.length;
    }

    // CodeCoverage: An error should always be detected, but just in case check anyway
    if (offset != this.mangled.length) {
      this.error = `Incomplete parse: '${this.mangled.substring(offset)}'`;
      return this;
    }

    this.demangled = this.name.toString();
    if (this.func !== null) {
      if (this.demangled.endsWith(" const")) {
        this.demangled = this.demangled.substring(0, this.demangled.length - 6);
        this.demangled += this.func.toString();
        this.demangled += " const";
      } else {
        this.demangled += this.func.toString();
      }
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

enum PartType {
  Part = "part", // Base
  UnscopedName = "unscoped-name", // A name, e.g "std" or "myfunc"
  ScopedName = "scoped-name", // A collection of unscoped names representing scope
  QualifiedType = "qualified-type", // A type in a template or parameter
  Function = "function", // A collection of types representing parameters
}
abstract class Part {
  constructor(type: PartType) {
    this.type = type;
  }
  public type: PartType;
  protected consumed: number = 0;
  protected error: string = "";

  public abstract toString(): string;
}

// https://stackoverflow.com/a/65847601/12282075
interface PartConstructor {
  parse(str: string, offset: number): ParseResult;
}
function checkPartCtor(clazz: PartConstructor) {}

// Length denoted string e.g. 3foo
class UnscopedNamePart extends Part {
  public static parse(str: string, offset: number = 0): ParseResult {
    const part = new UnscopedNamePart(str, offset);
    if (!part.error) {
      return { value: part, consumed: part.consumed };
    }
    return { value: null, consumed: 0, error: part.error };
  }
  public static raw(str: string): UnscopedNamePart {
    return new UnscopedNamePart(str, 0, true);
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
    super(PartType.UnscopedName);

    if (raw) {
      this.str = str.substring(offset);
      this.length = this.str.length;
      return;
    }

    if (str[offset + this.consumed] === "L") {
      this.isConst = true;
      this.consumed += 1;
    }

    if (!this.readLength(str, offset)) {
      this.consumed = 0;
      this.isConst = false;
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

  private length: number = 0;
  private str: string = "";
  private isConst: boolean = false;

  public toString(): string {
    let str = this.str;
    if (this.isConst) {
      str += " const";
    }
    return str;
  }
}
checkPartCtor(UnscopedNamePart);

class ScopedNamePart extends Part {
  public static parse(str: string, offset: number = 0): ParseResult {
    const part = new ScopedNamePart(str, offset);
    if (!part.error) {
      return { value: part, consumed: part.consumed };
    }
    return { value: null, consumed: 0, error: part.error };
  }

  private constructor(str: string, offset: number) {
    super(PartType.ScopedName);

    const scopingTerminated = str[offset + this.consumed] !== "N";
    if (!scopingTerminated) {
      this.consumed += 1;
    }

    while (offset + this.consumed < str.length) {
      if (str[offset + this.consumed] === "K") {
        if (scopingTerminated) {
          this.error =
            "ScopedNamePart: Const not allowed for non-terminated scoped names";
          return;
        }
        this.isConst = true;
        this.consumed += 1;
        continue;
      }
      if (str[offset + this.consumed] === "L") {
        if (scopingTerminated) {
          this.error =
            "ScopedNamePart: Const not allowed for non-terminated scoped names";
          return;
        }
        // this.isConst = true; // c++filt doesn't count this as const
        this.consumed += 1;
        continue;
      }
      break;
    }

    while (offset + this.consumed < str.length) {
      if (str[offset + this.consumed] === "S") {
        switch (str[offset + this.consumed + 1]) {
          case "t":
            this.parts.push(UnscopedNamePart.raw("std"));
            this.consumed += 2;
            continue;
          case "a":
            this.parts.push(UnscopedNamePart.raw("std"));
            this.parts.push(UnscopedNamePart.raw("allocator"));
            this.consumed += 2;
            continue;
          case "b":
            this.parts.push(UnscopedNamePart.raw("std"));
            this.parts.push(UnscopedNamePart.raw("basic_string"));
            this.consumed += 2;
            continue;
          case "s":
            // TODO: Use TemplatePart instead of hardcoded strings?
            this.parts.push(UnscopedNamePart.raw("std"));
            this.parts.push(
              UnscopedNamePart.raw(
                "basic_string<char,std::char_traits<char>,std::allocator<char>>"
              )
            );
            this.consumed += 2;
            continue;
          case "i":
            this.parts.push(
              UnscopedNamePart.raw(
                "std::basic_istream<char,std::char_traits<char>>"
              )
            );
            this.consumed += 2;
            continue;
          case "o":
            this.parts.push(
              UnscopedNamePart.raw(
                "std::basic_ostream<char,std::char_traits<char>>"
              )
            );
            this.consumed += 2;
            continue;
          case "d":
            this.parts.push(
              UnscopedNamePart.raw(
                "std::basic_iostream<char,std::char_traits<char>>"
              )
            );
            this.consumed += 2;
          default:
            break;
        }
      }
      const part = UnscopedNamePart.parse(str, offset + this.consumed);
      if (part.error) {
        this.error = part.error;
        return;
      }
      if (part.consumed === 0) {
        if (scopingTerminated && str[offset + this.consumed] === "E") {
          // std:: isn't scoped using N...E
          this.error = "ScopedNamePart: Tried to terminate implicit scoping";
          return;
        }
        break;
      }
      this.parts.push(part.value);
      this.consumed += part.consumed;
    }

    if (!scopingTerminated) {
      if (str[offset + this.consumed] !== "E") {
        this.error = "ScopedNamePart: Scoping not terminated";
        return;
      }
      this.consumed += 1;
    }

    if (this.parts.length === 0) {
      this.error = "ScopedNamePart: No parts";
      return;
    }
  }

  private parts: UnscopedNamePart[] = [];
  private isConst: boolean = false;

  public toString(): string {
    let str;
    if (this.parts.length === 1) {
      str = this.parts[0].toString();
    } else {
      str = this.parts.map((p) => p.toString()).join("::");
    }
    if (this.isConst) {
      str += " const";
    }
    return str;
  }
}
checkPartCtor(ScopedNamePart);

function parseNamePart(str: string, offset: number): ParseResult {
  if (str[offset] === "N" || str[offset] === "S") {
    return ScopedNamePart.parse(str, offset);
  } else {
    return UnscopedNamePart.parse(str, offset);
  }
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

  Member = "member", // M
  Imaginary = "imaginary", // G
  Complex = "complex", // H
  Restrict = "restrict", // r
  VendorExtendedType = "vendor-extended-type", // u
  VendorExtendedQualifier = "vendor-extended-qualifier", // U
  ExternC = "extern-c", // Y

  Array = "array", // A
  Ellipsis = "...", // z
  PackExpansion = "...T", // Dp
  Decltype2 = "decltype2", // Dt
  Decltype = "decltype", // DT

  Pointer = "*", // P
  Reference = "&", // R
  RValueReference = "&&", // O

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

  // TODO: Anything below needs looking into properly
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
const TypeMappingKeys = Object.keys(TypeMapping);
function offsetStringComp(
  left: string,
  leftOffset: number,
  right: string
): boolean {
  for (let i = 0; i < right.length; i++) {
    if (left[leftOffset + i] != right[i]) {
      return false;
    }
  }
  return true;
}

enum RefQualifier {
  None,
  Pointer = "*",
  Reference = "&",
  RValueReference = "&&",
}

class QualifiedTypePart extends Part {
  public static parse(str: string, offset: number): ParseResult {
    const type = new QualifiedTypePart(str, offset);
    if (type.error) {
      return { value: null, consumed: 0, error: type.error };
    }
    if (type.t === Type.ERROR) {
      return { value: null, consumed: 0 };
    }
    return { value: type, consumed: type.consumed };
  }

  private constructor(str: string, offset: number) {
    super(PartType.QualifiedType);

    if (str[offset + this.consumed] === "K") {
      this.isConst = true;
      this.consumed += 1;
    }
    if (str[offset + this.consumed] === "V") {
      this.isVolatile = true;
      this.consumed += 1;
    }

    if (str[offset + this.consumed] === "P") {
      this.t = Type.Pointer;
      this.refQualifier = RefQualifier.Pointer;
      this.consumed += 1;
    } else if (str[offset + this.consumed] === "R") {
      this.t = Type.Reference;
      this.refQualifier = RefQualifier.Reference;
      this.consumed += 1;
    } else if (str[offset + this.consumed] === "O") {
      this.t = Type.RValueReference;
      this.refQualifier = RefQualifier.RValueReference;
      this.consumed += 1;
    }
    if (this.refQualifier != RefQualifier.None) {
      this.ref = new QualifiedTypePart(str, offset + this.consumed);
      if (this.ref.error) {
        this.error = this.ref.error;
        return;
      }
      if (this.ref.consumed === 0) {
        this.consumed = 0;
        this.error = "QualifiedType: Failed to find type reference is for";
        return;
      }

      if (
        this.t === Type.Pointer &&
        (this.ref.t === Type.Reference || this.ref.t === Type.RValueReference)
      ) {
        /* gcc (GCC) 13.1.1 20230429
          echo -e "void foo(int &&*a) {}" | gcc -x c++ -S - -o-
          error: cannot declare pointer to ‘int&&’
          
          echo -e "void foo(int &*a) {}" | gcc -x c++ -S - -o-
          error: cannot declare pointer to ‘int&’
        */
        this.consumed = 0;
        this.error = "QualifiedType: C++ forbids pointer to reference";
        return;
      }
      if (
        (this.t === Type.Reference || this.t === Type.RValueReference) &&
        (this.ref.t === Type.Reference || this.ref.t === Type.RValueReference)
      ) {
        /* gcc (GCC) 13.1.1 20230429
          echo -e "void foo(int & &a) {}" | gcc -x c++ -S - -o-
          error: cannot declare reference to ‘int&’, which is not a typedef or a template type argument

          echo -e "void foo(int && &a) {}" | gcc -x c++ -S - -o-
          error: cannot declare reference to ‘int&&’, which is not a typedef or a template type argument

          echo -e "void foo(int & &&a) {}" | gcc -x c++ -S - -o-
          error: cannot declare reference to ‘int&’, which is not a typedef or a template type argument

          echo -e "void foo(int && &&a) {}" | gcc -x c++ -S - -o-
          error: cannot declare reference to ‘int&&’, which is not a typedef or a template type argument
        */
        this.consumed = 0;
        this.error = "QualifiedType: C++ forbids reference to reference";
        return;
      }
      this.consumed += this.ref.consumed;
      return;
    } else {
      for (const key of TypeMappingKeys) {
        if (offsetStringComp(str, offset + this.consumed, key)) {
          this.t = TypeMapping[key];
          this.consumed += key.length;
          return;
        }
      }

      const rawName = parseNamePart(str, offset + this.consumed);
      if (rawName.error) {
        this.error = rawName.error;
        return;
      }
      if (rawName.consumed === 0) {
        this.consumed = 0;
        const ALLOWLIST = ["."];
        if (ALLOWLIST.includes(str[offset + this.consumed])) {
          return;
        }
        this.error = `QualifiedType: Couldn't parse type '${str.substring(
          offset
        )}'`;
        return;
      }
      this.t = Type.RAW;
      this.rawType = rawName.value.toString();
      this.consumed += rawName.consumed;
    }
  }

  private t: Type = Type.ERROR;
  private rawType: string = "";

  private isConst: boolean = false;
  private isVolatile: boolean = false;

  private refQualifier: RefQualifier = RefQualifier.None;
  private ref: QualifiedTypePart | null = null;

  public toString(): string {
    let str = this.t === Type.RAW ? this.rawType : this.t;

    if (this.refQualifier !== RefQualifier.None && this.ref !== null) {
      str = this.ref.toString();
      str += this.refQualifier;
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
checkPartCtor(QualifiedTypePart);

// Function arguments
class FunctionPart extends Part {
  public static parse(str: string, offset: number): ParseResult {
    const part = new FunctionPart(str, offset);
    if (!part.error) {
      return { value: part, consumed: part.consumed };
    }
    return { value: part, consumed: 0, error: part.error };
  }

  private constructor(str: string, offset: number) {
    super(PartType.Function);

    if (str.length - offset === 0) {
      this.error = "Function: No arguments";
      return;
    }
    while (offset + this.consumed < str.length) {
      const param = QualifiedTypePart.parse(str, offset + this.consumed);
      if (param.error) {
        this.error = param.error;
        return;
      }
      if (param.consumed === 0) {
        break;
      }
      this.parameters.push(param.value);
      this.consumed += param.consumed;
    }
  }

  private parameters: Part[] = [];

  public toString(): string {
    return "(" + this.parameters.map((p) => p.toString()).join(", ") + ")";
  }
}
checkPartCtor(FunctionPart);
