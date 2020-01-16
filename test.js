const { evaluate } = require("./evaluator");

const testCases = [
  ["Expressions", "((6- -7)+ 3)", 16],
  ["Unary negeation", "-10", -10],
  ["Unary plus", "+10", 10],
  ["Multiply", "10 * 10", 100],
  ["Divide", "10 / 10", 1],
  // ["Parens", "1 + 1 * 10", 10],
];

testCases.forEach(testCase => {
  const [description, expression, expectedResult] = testCase
  test(description, async () => {
    const result = await evaluate(expression);
    expect(result).toBe(expectedResult);
  });
})
