const wabt = require("wabt")();
const { emit } = require("./emitter");
const { parse } = require("./parser");

async function evaluate(expression, {debug = false} = {}) {
  const ast = parse(expression);
  const programWat = emit(ast);
  const wat = `(module
    (func $sin (import "imports" "sin") (param f64) (result f64))
    (func $cos (import "imports" "cos") (param f64) (result f64))
    (func $tan (import "imports" "tan") (param f64) (result f64))
    (func $asin (import "imports" "asin") (param f64) (result f64))
    (func $acos (import "imports" "acos") (param f64) (result f64))
    (func $atan (import "imports" "atan") (param f64) (result f64))
    (func $atan2 (import "imports" "atan2") (param f64) (param f64) (result f64))
    (func $run (result f64) ${programWat})
    (export "run" (func $run))
  )`;
  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer } = wasmModule.toBinary({});
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    imports: {
      // TODO: Reimplement these functions natively in Wasm
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      atan2: Math.atan2,
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