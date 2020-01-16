const wabt = require("wabt")();
const { emit } = require("./emitter");
const { parse } = require("./parser");

async function main() {
  const expression = "((6- -7)+ 3)";

  const ast = parse(expression);

  const programWat = emit(ast);

  const wat = `(module
      (func (result i32)
          ${programWat}
      )
      (export "run" (func 0))
  )`;
  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer } = wasmModule.toBinary({});
  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod);
  const result = instance.exports.run();
  console.log("EXPRESSION: ", expression);
  console.log("--------");
  console.log("AST: ", ast);
  console.log("--------");
  console.log("WASM: ", wat);
  console.log("--------");
  console.log("WASM BINARY", new Buffer(buffer).toString('base64'))
  console.log("--------");
  console.log("RESULT: ", result);
}

main();
