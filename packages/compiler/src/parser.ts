import { preProcess } from "./preProcessor";
import { Ast } from "./types";
import { parse as envParse } from "./envParser";

export function parse(code: string): Ast {
  const processedCode = preProcess(code);
  return envParse(processedCode);
}
