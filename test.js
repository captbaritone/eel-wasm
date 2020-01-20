const { evaluate } = require("./evaluator");
const fs = require("fs");

const testCases = [
  ["Expressions", "g = ((6- -7)+ 3);", 16],
  ["Unary negeation", "g = -10;", -10],
  ["Unary plus", "g = +10;", 10],
  ["Multiply", "g = 10 * 10;", 100],
  ["Divide", "g = 10 / 10;", 1],
  ["Order of operations (+ and *)", "g = 1 + 1 * 10;", 11],
  ["Parens", "g = (1 + 1) * 10;", 20],
  ["Absolute value negative", "g = abs(-10);", 10],
  ["Absolute value positive", "g = abs(10);", 10],
  ["Function used as expression", "g = 1 + abs(-10);", 11],
  ["Min", "g = min(2, 10);", 2],
  ["Min reversed", "g = min(10, 2);", 2],
  ["Max", "g = max(2, 10);", 10],
  ["Max reversed", "g = max(10, 2);", 10],
  ["Sqrt", "g = sqrt(4);", 2],
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
  ["below (false)", "g = below(10, 4);", 1]
];

testCases.forEach(testCase => {
  const [description, expression, expectedResult, debug] = testCase;
  test(`${description}: "${expression}"`, async () => {
    const x = new WebAssembly.Global({ value: "f64", mutable: true }, 10);
    const g = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

    await evaluate(expression, {
      globals: { g, x },
      debug: debug === true
    });
    expect(g.value).toBe(expectedResult);
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

describe("Some actual equations", () => {
  let globals;
  beforeEach(() => {
    // TODO: Are all of these really global?
    globals = {
      r: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      cx1: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      cy1: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      d: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      dir: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      x1: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      y1: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      x2: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      y2: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      x3: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      y3: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      dx: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      dy: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      ib_r: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      ib_g: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      ib_b: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      wave_r: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      wave_g: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      wave_b: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      wave_x: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      wave_y: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      time: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      bass: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      x: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      y: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      mid: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      treb: new WebAssembly.Global({ value: "f64", mutable: true }, 0)
    };
  });

  const files = [
    "./fixtures/youtube_broadcast_yourself_per_frame.eel",
    "./fixtures/youtube_broadcast_yourself_per_pixel.eel"
  ];
  for (const file of files) {
    test(`Evaluate: ${file}`, async () => {
      const perFrame = fs.readFileSync(file, { encoding: "utf8" });
      await evaluate(perFrame, { globals, debug: false });
    });
  }
});
