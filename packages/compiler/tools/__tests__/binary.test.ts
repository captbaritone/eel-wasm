import shims from "../../src/shims";
import { compileModule } from "../../src/compiler";

// An attempt at generating Wasm binary directly (without the help fo wabt)
// TODO: We can probably delete this now.
test("Can execute hand crafted binary Wasm", async () => {
  var importObject = {
    main: {
      g: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      x: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
    },
    shims,
  };

  const buffer = compileModule({
    pools: {
      main: new Set(Object.keys(importObject.main)),
    },
    functions: {
      run: { pool: "main", code: "g = 100;" },
    },
  });

  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod, importObject);
  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.run();
  expect(importObject.main.g.value).toBe(100);
});

// Demonstrates using shared globals to establish a pool that contains values
// from multiple other pools without namespace collisions.
test("Can mix pools", async () => {
  const buffer = compileModule({
    pools: {
      poolA: new Set(["x"]),
      poolB: new Set(["x"]),
      poolAB: new Set(["a_x", "b_x"]),
    },
    functions: {
      setAX: { pool: "poolA", code: "x = 100;" },
      setBX: { pool: "poolB", code: "x = 50;" },
      setAXToBX: { pool: "poolAB", code: "a_x = b_x;" },
    },
  });

  const mod = await WebAssembly.compile(buffer);

  const aX = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  const bX = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

  const instance = await WebAssembly.instantiate(mod, {
    poolA: { x: aX },
    poolB: { x: bX },
    poolAB: { a_x: aX, b_x: bX },
    shims,
  });

  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.setAX();
  expect(aX.value).toBe(100);
  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.setBX();
  expect(bX.value).toBe(50);

  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.setAXToBX();
  expect(aX.value).toBe(50);
});

test("Can mix pools via a second module", async () => {
  const mod = await WebAssembly.compile(
    compileModule({
      pools: { poolA: new Set(["x"]), poolB: new Set(["x"]) },
      functions: {
        setAX: { pool: "poolA", code: "x = 100;" },
        setBX: { pool: "poolB", code: "x = 50;" },
      },
    })
  );

  const glueMod = await WebAssembly.compile(
    compileModule({
      pools: { poolAB: new Set(["a_x", "b_x"]) },
      functions: { setAXToBX: { pool: "poolAB", code: "a_x = b_x;" } },
    })
  );

  const aX = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  const bX = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

  const modInstance = await WebAssembly.instantiate(mod, {
    poolA: { x: aX },
    poolB: { x: bX },
    shims,
  });

  const glueModInstance = await WebAssembly.instantiate(glueMod, {
    poolAB: { a_x: aX, b_x: bX },
    shims,
  });

  // @ts-ignore Typescript does not know what shape our module is.
  modInstance.exports.setAX();
  expect(aX.value).toBe(100);
  // @ts-ignore Typescript does not know what shape our module is.
  modInstance.exports.setBX();
  expect(bX.value).toBe(50);

  // @ts-ignore Typescript does not know what shape our module is.
  glueModInstance.exports.setAXToBX();
  expect(aX.value).toBe(50);
});
