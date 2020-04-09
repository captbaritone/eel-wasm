import foldConstants from "./constantFolding";
import { parse } from "../parser";
import { print } from "../../tools/prettyPrinter";

const TESTS: [string, string, number][] = [
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
