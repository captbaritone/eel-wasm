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
  ["Max reversed", "max(10, 2)", 10]
];

testCases.forEach(testCase => {
  const [description, expression, expectedResult, debug] = testCase;
  test(description, async () => {
    const result = await evaluate(expression, { debug: debug === true });
    expect(result).toBe(expectedResult);
  });
});
