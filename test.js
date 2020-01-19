const { evaluate } = require("./evaluator");

const testCases = [
  ["Expressions", "((6- -7)+ 3)", 16],
  ["Unary negeation", "-10", -10],
  ["Unary plus", "+10", 10],
  ["Multiply", "10 * 10", 100],
  ["Divide", "10 / 10", 1],
  ["Order of operations (+ and *)", "1 + 1 * 10", 11],
  ["Parens", "(1 + 1) * 10", 20],
  ["Absolute value negative", "abs(-10)", 10],
  ["Absolute value positive", "abs(10)", 10],
  ["Function used as expression", "1 + abs(-10)", 11],
  ["Min", "min(2, 10)", 2],
  ["Min reversed", "min(10, 2)", 2],
  ["Max", "max(2, 10)", 10],
  ["Max reversed", "max(10, 2)", 10],
  ["Sqrt", "sqrt(4)", 2],
  ["Int", "int(4.5)", 4],
  ["Sin", "sin(10)", Math.sin(10)],
  ["Cos", "cos(10)", Math.cos(10)],
  ["Tan", "tan(10)", Math.tan(10)],
  ["Asin", "asin(0.5)", Math.asin(0.5)],
  ["Acos", "acos(0.5)", Math.acos(0.5)],
  ["Atan", "atan(0.5)", Math.atan(0.5)],
  ["Atan2", "atan2(1, 1)", Math.atan2(1, 1)],
  ["Assign to globals", "g = 10", 10],
  ["Read globals", "g", 0],
  ["Ternary pass", "1 ? 10 : 5", 10],
  ["Ternary fail", "0 ? 10 : 5", 5],
  ["Ternary with complex expressions", "0 * 0 ? 10 - 5 : 1 + 0", 1]
];

testCases.forEach(testCase => {
  const [description, expression, expectedResult, debug] = testCase;
  test(`${description}: "${expression}"`, async () => {
    const result = await evaluate(expression, {
      globals: new Set(["g"]),
      debug: debug === true
    });
    expect(result).toBe(expectedResult);
  });
});
