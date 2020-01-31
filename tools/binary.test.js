const wabt = require("wabt")();
const { compileModule } = require("../src/compiler");

// An attempt at generating Wasm binary directly (without the help fo wabt)
test.skip("Can execute hand crafted binary Wasm", async () => {
  const buffer = compileModule({
    functions: {
      run: "a = 10; g = (10 * 10);"
    },
    globals: new Set(["g"])
  });

  const wat = `(module
    (global $E0 (import "js" "g") (mut f64))
    (func 
        f64.const 100
        global.set $E0
        global.get $E0
        drop
    )
    (export "run" (func 0))
  )`;
  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer: minimal } = wasmModule.toBinary({});

  function toHex(arr) {
    return Array.from(arr).map(val =>
      val
        .toString(16)
        .padStart(2, 0)
        .toUpperCase()
    );
  }

  // expect(toHex(buffer)).toEqual(toHex(minimal));

  var importObject = {
    js: {
      g: new WebAssembly.Global({ value: "f64", mutable: true }, 0)
    }
  };

  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod, importObject);
  instance.exports.run();
  expect(importObject.js.g.value).toBe(100);
});
