const wabt = require("wabt")();
const { emit } = require("./emitter");
const { parse } = require("./parser");
const shims = require("./shims");

function compileModule({ globals, functions }) {
  const exportedFunctions = Object.entries(functions).map(
    ([functionName, expression]) => {
      return {
        type: "FUNCTION_EXPORT",
        name: functionName,
        function: parse(expression)
      };
    }
  );

  const ast = { type: "MODULE", exportedFunctions };
  return emit(ast, { globals });
}

async function loadModule({ globals, functions }) {
  const wat = compileModule({
    globals: new Set(Object.keys(globals)),
    functions
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
