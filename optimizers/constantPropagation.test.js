const propagateConstants = require("./constantPropagation");
const { parse } = require("../parser");
const { print } = require("../prettyPrinter");

const BEFORE_AFTER = [
  ["a = 10; g = a;", "a = 10; g = 10;"],
  ["g = 10; g = 20;", "g = 10; g = 20;"]
];

BEFORE_AFTER.forEach(([before, after]) => {
  test.only(`Can Fold "${before}" into "${after}"`, () => {
    const scriptAst = parse(before);
    const optimized = propagateConstants(scriptAst);
    expect(print(optimized)).toBe(after);
  });
});
