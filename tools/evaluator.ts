import shims from "../src/shims";
import { compileModule } from "../src/compiler";

export async function loadModule({
  globals,
  functions,
  optimize,
}: {
  globals: { [name: string]: WebAssembly.Global };
  functions: { [name: string]: string };
  optimize: boolean;
}) {
  const buffer = compileModule({
    globals: new Set(Object.keys(globals)),
    functions,
    optimize,
    shims,
  });
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    js: { ...globals },
    imports: shims,
  };

  return await WebAssembly.instantiate(mod, importObject);
}
