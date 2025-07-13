import { preProcess, getLoc, Mapper } from "./preProcessor";
import { Ast, SourceLocation } from "./types";
// @ts-ignore
import { parse as envParse } from "../build/parser";
// @ts-ignore
import { mapAst } from "./astUtils";
import { createUserError, createCompilerError } from "./errorUtils";

function mapLoc(loc: SourceLocation, mapper: Mapper): SourceLocation {
  const first = getLoc(mapper, loc.first_column);
  const last = getLoc(mapper, loc.last_column);
  return {
    first_column: first.column,
    last_column: last.column,
    first_line: first.line,
    last_line: last.line,
  };
}

export function parse(code: string): Ast {
  const [processedCode, mapper] = preProcess(code);
  try {
    const ast = envParse(processedCode);
    return mapAst(ast, (node: Ast) => {
      if (node.loc.first_line !== 1 || node.loc.last_line != 1) {
        throw createCompilerError("Unexpected multiline", node.loc, code);
      }
      return {
        ...node,
        loc: mapLoc(node.loc, mapper),
      };
    });
  } catch (e) {
    if (e.hash == null) {
      throw e;
    }
    throw createUserError(
      `Parse Error: ${e.message.split("\n")[3]}`,
      mapLoc(e.hash.loc, mapper),
      code
    );
  }
}
