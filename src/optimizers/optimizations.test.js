const foldConstants = require("./constantFolding");
const propagateConstants = require("./constantPropagation");
const { parse } = require("../parser");
const { print } = require("../../tools/prettyPrinter");

function runPass(ast) {
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
