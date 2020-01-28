const wabt = require("wabt")();
const { emit } = require("../src/emitter");
const { parse } = require("../src/parser");
const shims = require("../src/shims");
const optimizeAst = require("../src/optimizers/optimize")

function compileModule({ globals, functions, optimize = false }) {
  const exportedFunctions = Object.entries(functions).map(
    ([functionName, expression]) => {
      return {
        type: "FUNCTION_EXPORT",
        name: functionName,
        function: parse(expression)
      };
    }
  );

  let ast = { type: "MODULE", exportedFunctions };
  if(optimize) {
    ast = optimizeAst(ast);
  }
  return emit(ast, { globals });
}

async function loadModule({ globals, functions, optimize }) {
  const wat = compileModule({
    globals: new Set(Object.keys(globals)),
    functions,
    optimize
  });
  const wasmModule  = wabt.parseWat("somefile.wat", wat);
  const { buffer } = wasmModule.toBinary({});
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    js: { ...globals },
    imports: shims
  };

  return await WebAssembly.instantiate(mod, importObject);
}

module.exports = { loadModule };
