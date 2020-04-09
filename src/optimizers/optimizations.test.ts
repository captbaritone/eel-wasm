import foldConstants from "./constantFolding";
import propagateConstants from "./constantPropagation";
import { parse } from "../parser";
import { print } from "../../tools/prettyPrinter";
import { Ast } from "../types";

function runPass(ast: Ast) {
  return propagateConstants(foldConstants(ast));
}

test("Optimizaitions", () => {
  let ast = parse("a = 10; b = a + 10; c = b / 10;");
  let newAst = runPass(ast);
  while (ast !== newAst) {
    ast = newAst;
    newAst = runPass(newAst);
  }
  expect(print(newAst)).toMatchInlineSnapshot(`
    "a = 10;
    b = 20;
    c = 2;"
  `);
});
