const foldConstants = require("./constantFolding");
const { parse } = require("../parser");
const { print } = require("../../tools/prettyPrinter");

const TESTS = [
  ["Unary negetion", "-1;", -1],
  ["Unary Addition", "+1;", 1],
  ["Addition", "1 + 1;", 2],
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
