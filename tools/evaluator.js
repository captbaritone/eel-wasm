const wabt = require("wabt")()
const shims = require("../src/shims");
const {compileModule} = require("../src/compiler")


async function loadModule({ globals, functions, optimize }) {
  const buffer = compileModule({
    globals: new Set(Object.keys(globals)),
    functions,
    optimize,
    shims
  });
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    js: { ...globals },
    imports: shims
  };

  return await WebAssembly.instantiate(mod, importObject);
}

module.exports = { loadModule };
