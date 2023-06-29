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
  /*
    Function arguments come after closing E in namespaced
    Otherwise they are directly after first name part
    which can be a template: _Z4funcIiEvT_ func<int>(int)
  */
  private isNamespaced: boolean = false;

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
      } else if (this.mangled[offset] === "N") {
        this.isNamespaced = true;
        offset += 1;
      } else {
        break;
      }
    }

    const nameParts = parseNameParts(this.mangled, offset);
    this.parts.push(...nameParts.parts);
    offset += nameParts.consumed;

    if (this.parts.length === 0) {
      this.error = "No name parts";
      return this;
    }

    if (this.isNamespaced && this.mangled[offset] !== "E") {
      this.error = "Missing namespace close";
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
): { consumed: number; parts: NamePart[] } {
  let consumed = 0;
  let parts: NamePart[] = [];
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
    if (part.error || part.consumed === 0) {
      break;
    }
    parts.push(part.value);
    consumed += part.consumed;
  }
  return { consumed, parts };
}
