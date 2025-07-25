import shims from "../../src/shims";
import { compileModule } from "../../src/compiler";
import { expect, test } from "vitest";

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
