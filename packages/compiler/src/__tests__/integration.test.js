import { loadModule } from "../loader";
import fs from "fs";
import path from "path";
import MILKDROP_GLOBALS from "../../tools/milkdropGlobals";
import { parse } from "../parser";
import testCases from "../../tools/testCases";
import { expect, test, describe } from "vitest";

test("Minimal example", async () => {
  // Initialize global values available to your EEL scripts (and JS).
  const globals = {
    x: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
    y: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
  };

  // Build (compile/initialize) the Wasm module
  const mod = await loadModule({
    pools: { main: globals },
    functions: {
      ten: { pool: "main", code: "x = 10" },
      setXToY: { pool: "main", code: "x = y" },
    },
  });

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
    {
      "body": [
        {
          "loc": {
            "first_column": 0,
            "first_line": 1,
            "last_column": 1,
            "last_line": 1,
          },
          "type": "NUMBER_LITERAL",
          "value": 1,
        },
      ],
      "loc": {
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
  testCases.forEach((testCase, i) => {
    const [description, expression, expectedResult] = testCase;
    // Hack: Set this number to the number of the test in order to isolate just one.
    const testFunction = i === -1 ? test.only : test;
    testFunction(`${i}. ${description}: "${expression}"`, async () => {
      const x = new WebAssembly.Global({ value: "f64", mutable: true }, 10);
      const g = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

      const mod = await loadModule({
        pools: { main: { g, x } },
        functions: {
          run: { pool: "main", code: expression },
        },
      });

      mod.exports.run();
      expect(g.value).toBe(expectedResult);
    });
  });
});

// This
test("Empty equations are not created", async () => {
  const mod = await loadModule({
    pools: { main: {} },
    functions: {
      empty: { pool: "main", code: "" },
      whiteSpace: { pool: "main", code: "  \n\t " },
      comment: { pool: "main", code: "// IGNORE THIS" },
      hasCode: { pool: "main", code: "1" },
    },
  });

  expect(mod.exports.empty).toBe(undefined);
  expect(mod.exports.whiteSpace).toBe(undefined);
  expect(mod.exports.comment).toBe(undefined);
  expect(mod.exports.hasCode).not.toBe(undefined);
});

describe("Scopes", () => {
  test("isolate variables", async () => {
    const ax = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
    const bx = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

    const mod = await loadModule({
      pools: {
        a: { x: ax },
        b: { x: bx },
      },
      functions: {
        setInA: { pool: "a", code: "x = 10;" },
        setInB: { pool: "b", code: "x = 20;" },
      },
    });

    expect(ax.value).toBe(0);
    expect(bx.value).toBe(0);
    mod.exports.setInA();
    expect(ax.value).toBe(10);
    expect(bx.value).toBe(0);
    mod.exports.setInB();
    expect(ax.value).toBe(10);
    expect(bx.value).toBe(20);
  });

  test("share reg variables", async () => {
    const g = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
    const mod = await loadModule({
      pools: {
        a: {},
        b: { g },
      },
      functions: {
        setRegOne: { pool: "a", code: "reg01 = 10;" },
        setRegNintyNine: { pool: "a", code: "reg99 = 10;" },
        getRegOne: { pool: "b", code: "g = reg01;" },
        getRegNintyNine: { pool: "b", code: "g = reg99;" },
      },
    });

    mod.exports.getRegOne();
    expect(g.value).toBe(0);
    mod.exports.setRegOne();
    mod.exports.getRegOne();
    expect(g.value).toBe(10);

    mod.exports.getRegNintyNine();
    expect(g.value).toBe(0);
    mod.exports.setRegNintyNine();
    mod.exports.getRegNintyNine();
    expect(g.value).toBe(10);
  });
});

describe("Invalid pool for function", () => {
  test("function pool is not among defined", async () => {
    const ax = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
    const bx = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

    const moduleOptions = {
      pools: {
        a: { x: ax },
        b: { x: bx },
      },
      functions: {
        myInvalidFunction: { pool: "c", code: "x = 10;" },
      },
    };

    await expect(loadModule(moduleOptions)).rejects.toEqual(
      new Error(
        `The function "myInvalidFunction" was declared as using a variable pool named "c" which is not among the variable pools defined. The defined variable pools are: "a" and "b".`
      )
    );
  });

  test("no function pools are defined", async () => {
    const moduleOptions = {
      pools: {},
      functions: {
        myInvalidFunction: { pool: "c", code: "x = 10;" },
      },
    };

    await expect(loadModule(moduleOptions)).rejects.toEqual(
      new Error(
        `The function "myInvalidFunction" was declared as using a variable pool named "c" but no pools were defined.`
      )
    );
  });
});

test("Some actual equations", async () => {
  const globals = {};
  MILKDROP_GLOBALS.forEach(name => {
    globals[name] = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  });

  const perFrame = fs.readFileSync(
    path.join(
      __dirname,
      "../../fixtures/youtube_broadcast_yourself_per_frame.eel"
    ),
    { encoding: "utf8" }
  );
  const perPixel = fs.readFileSync(
    path.join(
      __dirname,
      "../../fixtures/youtube_broadcast_yourself_per_pixel.eel"
    ),
    { encoding: "utf8" }
  );

  const mod = await loadModule({
    pools: {
      main: globals,
    },
    functions: {
      perFrame: { pool: "main", code: perFrame },
      perPixel: { pool: "main", code: perPixel },
    },
  });

  expect(() => {
    mod.exports.perFrame();
    mod.exports.perPixel();
  }).not.toThrow();
});
