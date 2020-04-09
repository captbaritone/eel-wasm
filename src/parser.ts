import { preProcess } from "./preProcessor";
import { Ast } from "./types";
import builtParser from "../build/parser";
import buildParser from "../tools/buildParser";

let parserImpl = null;
// Always use the dynamic one, while we figure out why the built one doens't work.
if (process.env.NODE_ENV === "production") {
  parserImpl = builtParser;
} else {
  parserImpl = buildParser;
}

export function parse(code: string): Ast {
  const processedCode = preProcess(code);
  return parserImpl.parse(processedCode);
}
