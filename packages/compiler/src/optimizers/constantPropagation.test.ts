import propagateConstants from "./constantPropagation";
import { parse } from "../parser";
import { print } from "../../tools/prettyPrinter";

const BEFORE_AFTER = [
  // ["a = 10; g = a;", "a = 10; g = 10;"],
  ["g = 10; g = 20;", "g = 10; g = 20;"],
];

function joinLines(str: string): string {
  return str.replace("\n", " ");
}

BEFORE_AFTER.forEach(([before, after]) => {
  test(`Can Fold "${before}" into "${after}"`, () => {
    const scriptAst = parse(before);
    const optimized = propagateConstants(scriptAst);
    expect(joinLines(print(optimized))).toBe(after);
  });
});
