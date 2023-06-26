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

enum ArgumentTypes {
  Void = "void",
}

type FunctionArgumentsValue = ReadResult<ArgumentTypes[]>;
function parseArgumentTypes(str: string): FunctionArgumentsValue {
  let ret: ArgumentTypes[] = [];
  for (let i = 0; i < str.length; i++) {
    switch (str[i]) {
      case "v": {
        ret.push(ArgumentTypes.Void);
        break;
      }
      default: {
        return { consumed: i, value: ret };
      }
    }
  }
  return { consumed: str.length, value: ret };
}

class Substitution {
  values: string[] = [];

  push(sub: string) {
    this.values.push(sub);
  }

  pop(): string | undefined {
    const val = this.values.pop();
    return val;
  }

  count() {
    return this.values.length;
  }

  /*
    S_ is first
    S_0 is second
    S_1 is third
    ...
  */
  get(idx: "_" | number) {
    return idx === "_" ? this.values[0] : this.values[idx + 1];
  }
}

enum Modifiers {
  Pointer = "P",
  Const = "K",
  Reference = "R",
}

export function isMangled(symbol: string) {
  return symbol.startsWith("_Z") || symbol.startsWith("__Z");
}

export function demangle(input: string): string {
  if (!isMangled(input)) {
    return input;
  }
  let symbol = input.substring(input.indexOf("Z") + 1).replace(/ /g, "");

  const isConst = symbol[0] === "L";
  if (isConst) symbol = symbol.substring(1);

  const namespacingActive = symbol[0] === "N";
  if (namespacingActive) symbol = symbol.substring(1);

  const namespaceParts: string[] = [];
  while (symbol.length > 0) {
    const appreviation = symbol.substring(0, 2);
    switch (appreviation) {
      case "St":
        namespaceParts.push("std");
        symbol = symbol.substring(2);
        continue;
      case "Sa":
        namespaceParts.push("std::allocator");
        symbol = symbol.substring(2);
        continue;
      case "Sb":
        namespaceParts.push("std::basic_string");
        symbol = symbol.substring(2);
        continue;
      case "Ss":
        namespaceParts.push(
          "std::basic_string<char,::std::char_traits<char>,::std::allocator<char>>"
        );
        symbol = symbol.substring(2);
        continue;
      case "Si":
        namespaceParts.push(
          "std::basic_istream<char, ::std::char_traits<char> >"
        );
        symbol = symbol.substring(2);
        continue;
      case "So":
        namespaceParts.push(
          "std::basic_ostream<char,::std::char_traits<char>>"
        );
        symbol = symbol.substring(2);
        continue;
      case "Sd":
        namespaceParts.push(
          "std::basic_iostream<char,::std::char_traits<char>>"
        );
        symbol = symbol.substring(2);
        continue;
      default:
        break;
    }
    const partLen = readDenary(symbol);
    if (isNaN(partLen.value)) {
      break;
    }
    symbol = symbol.substring(partLen.consumed);
    if (symbol.length < partLen.value) {
      return input;
    }
    const part = symbol.substring(0, partLen.value);
    namespaceParts.push(part);
    symbol = symbol.substring(partLen.value);
  }
  const name = namespaceParts.pop();
  if (namespacingActive) {
    if (symbol[0] !== "E") {
      return input;
    }
    symbol = symbol.substring(1);
  }

  let demangled = isConst ? "const " : "";
  for (const part of namespaceParts) {
    demangled += part + "::";
  }
  demangled += name;

  return demangled;
}
