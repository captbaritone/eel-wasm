const shims = require("../src/shims");
const wabt = require("wabt")();
const { compileModule } = require("../src/compiler");

function toHex(arr) {
  return Array.from(arr).map(val =>
    val
      .toString(16)
      .padStart(2, 0)
      .toUpperCase()
  );
}

// An attempt at generating Wasm binary directly (without the help fo wabt)
test("Can execute hand crafted binary Wasm", async () => {
  const buffer = compileModule({
    functions: {
      run: "g = 100;"
    },
    shims: {
      sin: shims.sin,
      pow: shims.pow
    },
    globals: new Set(["g"])
  });

  var importObject = {
    js: {
      g: new WebAssembly.Global({ value: "f64", mutable: true }, 0)
    },
    imports: shims
  };

  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod, importObject);
  instance.exports.run();
  expect(importObject.js.g.value).toBe(100);

  // const bufferModual = wabt.readWasm(buffer, { readDebugNames: true });

  const wat = `(module
    (global $E0 (import "js" "g") (mut f64))
    (func $sin (import "imports" "sin") (param f64) (result f64))
    (func $pow (import "imports" "pow") (param f64) (param f64) (result f64))
    (func 
        f64.const 100
        global.set $E0
        global.get $E0
        drop
    )
    (export "run" (func 2))
  )`;
  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer: minimal } = wasmModule.toBinary({});
  expect(toHex(buffer)).toEqual(toHex(minimal));
});
