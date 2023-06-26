interface StringRead<ValueType> {
  value: ValueType;
  length: number;
}

/*
Read a positive integer and 
*/
type DenaryValue = StringRead<number>;
function readDenary(str: string): DenaryValue {
  let numStr = "",
    i = 0;
  while (str[i] >= "0" && str[i] <= "9") {
    numStr += str[i];
    i++;
  }
  return { value: parseInt(numStr), length: i };
}

enum ArgumentTypes {
  Void = "void",
}

type FunctionArgumentsValue = StringRead<ArgumentTypes[]>;
function parseArgumentTypes(str: string): FunctionArgumentsValue {
  let ret: ArgumentTypes[] = [];
  for (let i = 0; i < str.length; i++) {
    switch (str[i]) {
      case "v": {
        ret.push(ArgumentTypes.Void);
        break;
      }
      default: {
        return { length: i, value: ret };
      }
    }
  }
  return { length: str.length, value: ret };
}

export function isMangled(symbol: string) {
  return symbol.startsWith("_Z");
}

export function demangle(input: string): string {
  if (!isMangled(input)) {
    return input;
  }
  let symbol = input.substring(2);

  const nameParts: string[] = [];
  while (symbol.length > 0) {
    const partLen = readDenary(symbol);
    if (
      isNaN(partLen.value) ||
      symbol.length < partLen.length + partLen.value
    ) {
      break;
    }
    nameParts.push(
      symbol.substring(partLen.length, partLen.length + partLen.value)
    );
    symbol = symbol.substring(partLen.length + partLen.value);
  }
  if (nameParts.length === 0) {
    return input;
  }

  const argTypes = parseArgumentTypes(symbol);
  if (argTypes.length > 0) {
    let demangled = nameParts.join("::") + `(` + argTypes.value.join(",") + ")";
    return demangled;
  }

  return "";
}

export const __EXPORTED_FOR_TESTING_DONT_USE = {
  readDenary,
};
