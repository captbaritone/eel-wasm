// An example file that executes Wasm. Useful for trying Wasm code out.
// It's in this test so that I can run it in a fast-feedback loop (`jest --watch`)

const wabt = require("wabt")();

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
