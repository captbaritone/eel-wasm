const { evaluate } = require("./evaluator");

test("expressions", async () => {
  const result = await evaluate("((6- -7)+ 3)");
  expect(result).toBe(16);
});
