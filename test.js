const { loadModule } = require("./evaluator");
const fs = require("fs");
const MILKDROP_GLOBALS = require("./milkdropGlobals");
const { parse } = require("./parser");

test("Minimal example", async () => {
  // Initialize global values avaliable to your EEL scripts (and JS).
  const globals = {
    x: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
    y: new WebAssembly.Global({ value: "f64", mutable: true }, 0)
  };

  // Define the EEL scripts that your module will include
  const functions = {
    ten: "x = 10;",
    setXToY: "x = y;"
  };

  // Build (compile/initialize) the Wasm module
  const mod = await loadModule({ globals, functions });

  // Assert that x starts as zero
  expect(globals.x.value).toBe(0);

  // Run a compiled EEL script and assert that it ran
  mod.exports.ten();
  expect(globals.x.value).toBe(10);

  // Change a global value from JS, and assert that EEL code uses the new value
  globals.y.value = 5;
  mod.exports.setXToY();
  expect(globals.x.value).toBe(5);
});

test("parse", () => {
  expect(parse("1;")).toMatchInlineSnapshot(`
    Object {
      "body": Array [
        Object {
          "column": 0,
          "line": 1,
          "type": "NUMBER_LITERAL",
          "value": 1,
        },
      ],
      "column": 0,
      "line": 1,
      "type": "SCRIPT",
    }
  `);
});
const testCases = [
  ["Empty program", "", 0],
  ["Expressions", "g = ((6- -7)+ 3);", 16],
  ["Number", "g = 5;", 5],
  ["Number with decimal", "g = 5.5;", 5.5],
  ["Number with decimal and no leading whole", "g = .5;", 0.5],
  // ["Optional final semi", "g = 5", 5],
  ["Unary negeation", "g = -10;", -10],
  ["Unary plus", "g = +10;", 10],
  ["Multiply", "g = 10 * 10;", 100],
  ["Divide", "g = 10 / 10;", 1],
  ["Mod", "g = 5 % 2;", 1],
  ["Bitwise and", "g = 3 & 5;", 1],
  ["Bitwise or", "g = 3 | 5;", 7],
  ["Order of operations (+ and *)", "g = 1 + 1 * 10;", 11],
  ["Order of operations (+ and /)", "g = 1 + 1 / 10;", 1.1],
  ["Order of operations (unary - and +)", "g = -1 + 1;", 0],
  ["Parens", "g = (1 + 1) * 10;", 20],
  ["Absolute value negative", "g = abs(-10);", 10],
  ["Absolute value positive", "g = abs(10);", 10],
  ["Function used as expression", "g = 1 + abs(-10);", 11],
  ["Min", "g = min(2, 10);", 2],
  ["Min reversed", "g = min(10, 2);", 2],
  ["Max", "g = max(2, 10);", 10],
  ["Max reversed", "g = max(10, 2);", 10],
  ["Sqrt", "g = sqrt(4);", 2],
  ["Sqr", "g = sqr(10);", 100],
  ["Int", "g = int(4.5);", 4],
  ["Sin", "g = sin(10);", Math.sin(10)],
  ["Cos", "g = cos(10);", Math.cos(10)],
  ["Tan", "g = tan(10);", Math.tan(10)],
  ["Asin", "g = asin(0.5);", Math.asin(0.5)],
  ["Acos", "g = acos(0.5);", Math.acos(0.5)],
  ["Atan", "g = atan(0.5);", Math.atan(0.5)],
  ["Atan2", "g = atan2(1, 1);", Math.atan2(1, 1)],
  ["Assign to globals", "g = 10;", 10],
  ["Read globals", "g = x;", 10],
  ["Ternary pass", "g = 1 ? 10 : 5;", 10],
  ["Ternary fail", "g = 0 ? 10 : 5;", 5],
  ["Ternary with complex expressions", "g = 0 * 0 ? 10 - 5 : 1 + 0;", 1],
  ["Multiple statements", "g = 10; g = 20;", 20],
  ["Multiple statements expression", "(g = 10; g = 20;);", 20],
  ["Multiple statements expression implcit return", "g = (0; 20 + 5;);", 25],
  ["if", "g = if(0, 20, 10);", 10],
  ["if", "g = if(0, 20, 10);", 10],
  ["if does not short-circit (consiquent)", "if(0, (g = 10;), 10);", 10],
  ["if does not short-circit (alternate)", "if(1, (10), (g = 10;));", 10],
  ["above (true)", "g = above(10, 4);", 0],
  ["above (false)", "g = above(4, 10);", 1],
  ["below (true)", "g = below(4, 10);", 0],
  ["below (false)", "g = below(10, 4);", 1],
  ["Line comments", "g = 10; // g = 20;", 10],
  ["Equal (false)", "g = equal(10, 5);", 0],
  ["Equal (true)", "g = equal(10, 10);", 1],
  ["Pow", "g = pow(2, 10);", 1024],
  ["Log", "g = log(10);", Math.log(10)],
  ["Log10", "g = log10(10);", Math.log10(10)],
  ["Sign (10)", "g = sign(10);", 1],
  ["Sign (-10)", "g = sign(-10);", -1],
  ["Sign (0)", "g = sign(0);", 0],
  ["Sign (-0)", "g = sign(-0);", 0],
  ["Local variables", "a = 10; g = a * a;", 100],
  ["Local variable assignment (implicit return)", "g = a = 10;", 10],
  ["Bor (true, false)", "g = bor(10, 0);", 1],
  ["Bor (false, true)", "g = bor(0, 2);", 1],
  ["Bor (true, true)", "g = bor(1, 7);", 1],
  ["Bor (false, false)", "g = bor(0, 0);", 0],
  ["Bnot (true)", "g = bnot(10);", 0],
  ["Bnot (false)", "g = bnot(0);", 1],
  ["Plus equals", "g = 5; g += 5;", 10],
  ["Plus equals (local var)", "a = 5; a += 5; g = a;", 10],
  ["Minus equals", "g = 5; g -= 4;", 1],
  ["Minus equals (local var)", "a = 5; a -= 4; g = a;", 1],
  ["Times equals", "g = 5; g *= 4;", 20],
  ["Times equals (local var)", "a = 5; a *= 4; g = a;", 20],
  ["Divide equals", "g = 5; g /= 2;", 2.5],
  ["Divide equals (local var)", "a = 5; a /= 2; g = a;", 2.5],
  ["Mod equals", "g = 5; g %= 2;", 1],
  ["Mod equals (local var)", "a = 5; a %= 2; g = a;", 1],
  ["Statement block as argument", "g = int(g = 5; g + 10.5;);", 15]
  // ["Boolean and", "g = 1 && 2;", 2],
  // ["Boolean and", "g = 1 || 2;", 1],
];

describe("Small test cases", () => {
  testCases.forEach(testCase => {
    const [description, expression, expectedResult] = testCase;
    describe(`${description}: "${expression}"`, () => {
      test("not optimized", async () => {
        const x = new WebAssembly.Global({ value: "f64", mutable: true }, 10);
        const g = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

        const mod = await loadModule({
          globals: { g, x },
          functions: { run: expression }
        });

        mod.exports.run();
        expect(g.value).toBe(expectedResult);
      });
      test("optimized", async () => {
        const x = new WebAssembly.Global({ value: "f64", mutable: true }, 10);
        const g = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

        const mod = await loadModule({
          globals: { g, x },
          functions: { run: expression },
          optimize: true
        });

        mod.exports.run();
        expect(g.value).toBe(expectedResult);
      });
    });
  });
});

const wabt = require("wabt")();

// An example file that executes Wasm. Useful for trying Wasm code out.
// It's in this test so that I can run it in a fast-feedback loop (`jest --watch`)
test("Can execute Wasm", async () => {
  const wat = `(module
      (func (result i32)
          i32.const 10
      )
      (export "run" (func 0))
  )`;
  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer } = wasmModule.toBinary({});
  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod);
  const result = instance.exports.run();
  expect(result).toBe(10);
});

test("Some actual equations", async () => {
  const globals = {};
  MILKDROP_GLOBALS.forEach(name => {
    globals[name] = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  });

  const perFrame = fs.readFileSync(
    "./fixtures/youtube_broadcast_yourself_per_frame.eel",
    { encoding: "utf8" }
  );
  const perPixel = fs.readFileSync(
    "./fixtures/youtube_broadcast_yourself_per_pixel.eel",
    { encoding: "utf8" }
  );

  const mod = await loadModule({
    globals,
    functions: {
      perFrame,
      perPixel
    }
  });

  expect(() => {
    mod.exports.perFrame();
    mod.exports.perPixel();
  }).not.toThrow();
});
