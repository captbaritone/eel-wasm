import { compileModule } from "../../src/compiler.js";
import { test, expect } from "vitest";
import wabtInit from "wabt";

test("wasm binary WAT output matches snapshot (debug names)", async () => {
  // Use all built-in functions in the test function
  const code = [
    "g = sqr(2);", // function
    "g = 1 | 2;", // bor (bitwise or)
    "g = 1 & 2;", // band (bitwise and)
    "g = sign(2);", // function
    "g = 5 % 2;", // mod
    "g = 4 / 2;", // div
  ].join("\n");
  const buffer = compileModule({
    pools: { main: new Set(["g"]) },
    functions: {
      test: { pool: "main", code },
      myfunc: { pool: "main", code: "result = x * 2;" },
    },
  });

  const wabt = await wabtInit();
  const myModule = wabt.readWasm(buffer, { readDebugNames: true });
  const wat = myModule.toText({ foldExprs: false, inlineExport: false });

  expect(wat).toMatchSnapshot();
});
