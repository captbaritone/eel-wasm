import { parse } from "../parser";
import testCases from "../../tools/testCases";
import { emitter } from "../javaScriptEmitter";

function compileToJavaScript(code: string): string {
  const ast = parse(code);
  return emitter(ast, { rawSource: code });
}

describe.skip("Small test cases", () => {
  const onlyIndex = null;
  testCases.forEach((testCase, i) => {
    const [description, expression, expectedResult] = testCase;
    const testFn = onlyIndex === i ? test.only : test;
    testFn(`(${i}): ${description}: "${expression}"`, async () => {
      const javaScriptSource = compileToJavaScript(expression);
      // console.log(javaScriptSource);

      const fn = new Function("a", javaScriptSource);

      const a = { g: 0, x: 10 };
      fn(a);

      expect(a.g).toBe(expectedResult);
    });
  });
});
