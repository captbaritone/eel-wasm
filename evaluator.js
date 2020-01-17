const wabt = require("wabt")();
const { emit } = require("./emitter");
const { parse } = require("./parser");

async function evaluate(expression, {debug = false} = {}) {
  const ast = parse(expression);
  const programWat = emit(ast);
  let wat = `(module
    (func $sin (import "imports" "sin") (param f64) (result f64))
    (func $run (result f64) ${programWat})
    (export "run" (func 1))
  )`;
  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer } = wasmModule.toBinary({});
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    imports: {
      // TODO: Reimplement these functions natively in Wasm
      sin: Math.sin
    }
  };

  const instance = await WebAssembly.instantiate(mod, importObject);
  const result = instance.exports.run();
  if(debug) {
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
  return result;
}

module.exports = {evaluate}