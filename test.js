const { evaluate } = require("./evaluator");

const testCases = [
  ["Expressions", "((6- -7)+ 3)", 16],
  ["Unary negeation", "-10", -10],
  ["Unary plus", "+10", 10],
  ["Multiply", "10 * 10", 100],
  ["Divide", "10 / 10", 1],
  ["Order of operations (+ and *)", "1 + 1 * 10", 11],
  ["Parens", "(1 + 1) * 10", 20],
  ["Absolute value", "abs(-10)", 10],
  ["Function used as expression", "1 + abs(-10)", 11]
];

testCases.forEach(testCase => {
  const [description, expression, expectedResult, debug] = testCase;
  test(description, async () => {
    const result = await evaluate(expression, { debug: debug === true });
    expect(result).toBe(expectedResult);
  });
});
