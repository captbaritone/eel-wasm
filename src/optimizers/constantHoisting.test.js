const hoistConstants = require("./constantHoisting");
const { parse } = require("../parser");
const { print } = require("../../tools/prettyPrinter");

const BEFORE_AFTER = [
  ["g = 10;", "const_0 = 10; g = const_0;"],
  ["g = 10 * 10;", "const_0 = 10; g = const_0 * const_0;"],
  ["g = 1 * 10;", "const_0 = 1; const_1 = 10; g = const_0 * const_1;"]
];

function joinLines(str) {
  return str.replace(/[\s\n]+/g, " ");
}

BEFORE_AFTER.forEach(([before, after]) => {
  test.only(`Can hoist from "${before}" into "${after}"`, () => {
    const scriptAst = parse(before);
    const optimized = hoistConstants(scriptAst);
    expect(joinLines(print(optimized))).toBe(after);
  });
});
