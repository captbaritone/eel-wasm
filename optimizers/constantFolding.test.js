const foldConstants = require("./constantFolding");
const { parse } = require("../parser");

function getSoleExpressionFromScript(ast) {
  expect(ast.type).toBe("SCRIPT");
  expect(ast.body.type).toBe("STATEMENT_BLOCK");
  expect(ast.body.body.length).toBe(1);
  expect(ast.body.body[0].type).toBe("STATEMENT");
  return ast.body.body[0].expression;
}

const TESTS = [
  ["Unary negetion", "-1;", -1],
  ["Unary Addition", "+1;", 1],
  ["Addition", "1 + 1;", 2],
  ["Conditional", "1 ? 10 : 5;", 10],
  ["Conditional (false)", "0 ? 10 : 5;", 5],
  ["Complex", "-0 ? 10 : -(5 - 4 + (5 * 5) / 2);", -13.5]
];

describe("Constant Folding", () => {
  TESTS.forEach(([name, expression, result]) => {
    test(`${name} (${expression})`, () => {
      const scriptAst = parse(expression);
      const expressionAst = getSoleExpressionFromScript(scriptAst);
      const optimized = foldConstants(expressionAst);
      expect(optimized.type).toBe("NUMBER_LITERAL");
      expect(optimized.value).toBe(result);
    });
  });
});
