const shims = require("../src/shims");
const { compileModule } = require("../src/compiler");

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
    shims: {
      sin: shims.sin,
      tan: shims.tan,
      asin: shims.asin,
      acos: shims.acos,
      atan: shims.atan,
      rand: shims.rand,
      pow: shims.pow,
      log: shims.log,
      log10: shims.log10,
    },
    globals: new Set(Object.keys(importObject.js)),
    optimize: false,
  });

  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod, importObject);
  instance.exports.run();
  expect(importObject.js.g.value).toBe(100);
});
