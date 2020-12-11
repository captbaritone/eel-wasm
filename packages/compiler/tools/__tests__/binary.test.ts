import shims from "../../src/shims";
import { compileModule } from "../../src/compiler";
import asc from "assemblyscript/cli/asc";

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

test("assemblyScript", async () => {
  const mod = await WebAssembly.compile(
    compileModule({
      pools: { poolA: new Set(["x"]), poolB: new Set(["x"]) },
      functions: {
        setAX: { pool: "poolA", code: "x = 100;" },
        setBX: { pool: "poolB", code: "x = 50;" },
      },
    })
  );

  const aX = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  const bX = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

  const modInstance = await WebAssembly.instantiate(mod, {
    poolA: { x: aX },
    poolB: { x: bX },
    shims,
  });

  let script = `
    @external("poolAB", "aX")
    declare let aX: f64;

    @external("poolAB", "bX")
    declare let bX: f64;

    export function setAXToBX(): void {
      aX = bX;
    }
  `;
  await asc.ready;
  const { binary, text, stdout, stderr } = asc.compileString(script, {});
  expect(stderr.toString()).toBe("");
  const glueMod = await WebAssembly.compile(binary);

  const glueModInstance = await WebAssembly.instantiate(glueMod, {
    poolAB: { aX, bX },
    env: {
      abort: () => {
        // No idea why we need this.
        console.log("abort");
      },
    },
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

test("Reset variables", async () => {
  const buffer = compileModule({
    pools: {
      poolA: new Set(["x"]),
      resetPool: new Set(["x"]),
    },
    functions: {
      setX: { pool: "poolA", code: "x = 100;" },
      save: { pool: "resetPool", code: "save_x = x;" },
      restore: { pool: "resetPool", code: "x = save_x;" },
    },
  });

  const mod = await WebAssembly.compile(buffer);

  const x = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

  const instance = await WebAssembly.instantiate(mod, {
    poolA: { x },
    resetPool: { x },
    shims,
  });

  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.save();
  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.setX();
  expect(x.value).toBe(100);
  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.restore();
  expect(x.value).toBe(0);
});

async function makeResetModule(pool) {
  const resetBuffer = compileModule({
    pools: {
      resetPool: new Set(["x"]),
    },
    functions: {
      save: { pool: "resetPool", code: "save_x = x;" },
      restore: { pool: "resetPool", code: "x = save_x;" },
    },
  });

  const resetMod = await WebAssembly.compile(resetBuffer);

  return await WebAssembly.instantiate(resetMod, {
    resetPool: pool,
    shims,
  });
}

test("Reset variables from second module", async () => {
  const x = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  const buffer = compileModule({
    pools: {
      poolA: new Set(["x"]),
    },
    functions: {
      setX: { pool: "poolA", code: "x = 100;" },
    },
  });

  const mod = await WebAssembly.compile(buffer);

  const instance = await WebAssembly.instantiate(mod, {
    poolA: { x },
    resetPool: { x },
    shims,
  });

  const resetInstance = await makeResetModule({ x });

  // @ts-ignore Typescript does not know what shape our module is.
  resetInstance.exports.save();
  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.setX();
  expect(x.value).toBe(100);
  // @ts-ignore Typescript does not know what shape our module is.
  resetInstance.exports.restore();
  expect(x.value).toBe(0);
});

async function makeAssemblyScriptResetModule(pool) {
  let script = `
    @external("resetPool", "x")
    declare let x: f64;

    let save_x: f64 = 0;

    export function save(): void {
      save_x = x;
    }
    export function restore(): void {
      x = save_x;
    }
  `;
  await asc.ready;
  const { binary, text, stdout, stderr } = asc.compileString(script, {});
  expect(stderr.toString()).toBe("");
  const glueMod = await WebAssembly.compile(binary);

  return await WebAssembly.instantiate(glueMod, {
    resetPool: pool,
    env: {
      abort: () => {
        // No idea why we need this.
        console.log("abort");
      },
    },
  });
}

test("Reset variables from second assembly script module", async () => {
  const x = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  const buffer = compileModule({
    pools: {
      poolA: new Set(["x"]),
    },
    functions: {
      setX: { pool: "poolA", code: "x = 100;" },
    },
  });

  const mod = await WebAssembly.compile(buffer);

  const instance = await WebAssembly.instantiate(mod, {
    poolA: { x },
    resetPool: { x },
    shims,
  });

  const resetInstance = await makeAssemblyScriptResetModule({ x });

  // @ts-ignore Typescript does not know what shape our module is.
  resetInstance.exports.save();
  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.setX();
  expect(x.value).toBe(100);
  // @ts-ignore Typescript does not know what shape our module is.
  resetInstance.exports.restore();
  expect(x.value).toBe(0);
});

test("Read FloatArray out of Wasm (AssemblyScript)", async () => {
  // Reserve 16 bytes of memory (starting at 0) for our program to use
  const memoryBase = 16;
  let script = `
    export function set(): void {
      store<f64>(0, .5);
      store<f64>(8, 2.5);
    }
  `;
  await asc.ready;
  const { binary, text, stdout, stderr } = asc.compileString(script, {
    memoryBase,
  });
  expect(stderr.toString()).toBe("");
  const glueMod = await WebAssembly.compile(binary);

  const instance = await WebAssembly.instantiate(glueMod, {
    env: {
      abort: () => {
        // No idea why we need this.
        console.log("abort");
      },
    },
  });

  // @ts-ignore Typescript does not know what shape our module is.
  const mem = new Float64Array(instance.exports.memory.buffer, 0, memoryBase);
  expect(mem[0]).toBe(0);
  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.set();
  expect(mem[0]).toBe(0.5);
  expect(mem[1]).toBe(2.5);
});
