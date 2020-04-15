import shims from "../src/shims";
import { compileModule } from "../src/compiler";

// An attempt at generating Wasm binary directly (without the help fo wabt)
test("Can execute hand crafted binary Wasm", async () => {
  var importObject = {
    js: {
      g: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
      x: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
    },
    imports: shims,
  };

  const buffer = compileModule({
    functions: {
      run: "g = 100;",
    },
    shims,
    globals: new Set(Object.keys(importObject.js)),
  });

  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod, importObject);
  // @ts-ignore Typescript does not know what shape our module is.
  instance.exports.run();
  expect(importObject.js.g.value).toBe(100);
});
