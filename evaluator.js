const wabt = require("wabt")();
const { emit } = require("./emitter");
const { parse } = require("./parser");

async function evaluate(
  expression,
  { globals = new Set(), debug = false }
) {
  const ast = parse(expression);
  const wat = emit(ast, { globals });

  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer } = wasmModule.toBinary({});
  const mod = await WebAssembly.compile(buffer);

  const global = new WebAssembly.Global({ value: "f64", mutable: true }, 0);

  var importObject = {
    js: {
      global
    },
    imports: {
      // TODO: Reimplement these functions natively in Wasm
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      atan2: Math.atan2
    }
  };

  const instance = await WebAssembly.instantiate(mod, importObject);
  const result = instance.exports.run();
  if (debug) {
    console.log("EXPRESSION: ", expression);
    console.log("--------");
    console.log("AST: ", ast);
    console.log("--------");
    console.log("WASM: ", wat);
    console.log("--------");
    console.log("WASM BINARY", new Buffer(buffer).toString("base64"));
    console.log("--------");
    console.log("RESULT: ", result);
    console.log("--------");
    console.log("$g", global.value);
  }
  return result;
}

module.exports = { evaluate };
