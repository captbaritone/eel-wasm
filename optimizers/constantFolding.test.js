const foldConstants = require("./constantFolding");
const { parse } = require("../parser");
const {print} = require("../prettyPrinter")

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
      const optimized = foldConstants(scriptAst);
      expect(print(optimized)).toBe(String(result));
    });
  });
});
