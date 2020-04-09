import foldConstants from "./constantFolding";
import propagateConstants from "./constantPropagation";
import { Ast } from "../types";

// const hoistConstants = require("./constantHoisting");

function runPass(ast: Ast): Ast {
  return propagateConstants(foldConstants(ast));
}

function optimize(ast: Ast): Ast {
  let newAst = runPass(ast);
  while (ast !== newAst) {
    ast = newAst;
    newAst = runPass(newAst);
  }
  // newAst = hoistConstants(newAst);
  return newAst;
}

export default optimize;
