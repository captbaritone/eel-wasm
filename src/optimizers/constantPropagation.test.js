const propagateConstants = require("./constantPropagation");
const { parse } = require("../parser");
const { print } = require("../../tools/prettyPrinter");

const BEFORE_AFTER = [
  ["a = 10; g = a;", "a = 10; g = 10;"],
  ["g = 10; g = 20;", "g = 10; g = 20;"]
];

function joinLines(str) {
  return str.replace("\n", " ")
}

BEFORE_AFTER.forEach(([before, after]) => {
  test.only(`Can Fold "${before}" into "${after}"`, () => {
    const scriptAst = parse(before);
    const optimized = propagateConstants(scriptAst);
    expect(joinLines(print(optimized))).toBe(after);
  });
});
