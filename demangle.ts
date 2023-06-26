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

  const nameLen = readDenary(symbol);
  if (isNaN(nameLen.value)) {
    return input;
  }
  symbol = symbol.substring(nameLen.consumed);
  if (symbol.length < nameLen.value) {
    return input;
  }
  const name = symbol.substring(0, nameLen.value);
  symbol = symbol.substring(nameLen.value);

  let demangled = isConst ? "const " : "";
  demangled += name;
  return demangled;
}
