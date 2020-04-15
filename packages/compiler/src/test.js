const { loadModule } = require("../tools/evaluator");
const fs = require("fs");
const MILKDROP_GLOBALS = require("../tools/milkdropGlobals");
const { parse } = require("./parser");
const testCases = require("../tools/testCases");

test("Minimal example", async () => {
  // Initialize global values avaliable to your EEL scripts (and JS).
  const globals = {
    x: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
    y: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
  };

  // Define the EEL scripts that your module will include
  const functions = {
    ten: "x = 10;",
    setXToY: "x = y;",
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
          "loc": Object {
            "first_column": 0,
            "first_line": 1,
            "last_column": 1,
            "last_line": 1,
          },
          "type": "NUMBER_LITERAL",
          "value": 1,
        },
      ],
      "loc": Object {
        "first_column": 0,
        "first_line": 1,
        "last_column": 2,
        "last_line": 1,
      },
      "type": "SCRIPT",
    }
  `);
});

describe("Small test cases", () => {
  testCases.forEach(testCase => {
    const [description, expression, expectedResult] = testCase;
    test(`${description}: "${expression}"`, async () => {
      const x = new WebAssembly.Global({ value: "f64", mutable: true }, 10);
      const g = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

      const mod = await loadModule({
        globals: { g, x },
        functions: { run: expression },
      });

      mod.exports.run();
      expect(g.value).toBe(expectedResult);
    });
  });
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
      perPixel,
    },
  });

  expect(() => {
    mod.exports.perFrame();
    mod.exports.perPixel();
  }).not.toThrow();
});
