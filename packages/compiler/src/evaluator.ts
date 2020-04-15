import shims from "./shims";
import { compileModule } from "./compiler";

export async function loadModule({
  globals,
  functions,
}: {
  globals: { [name: string]: WebAssembly.Global };
  functions: { [name: string]: string };
}) {
  const buffer = compileModule({
    globals: new Set(Object.keys(globals)),
    functions,
  });
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    js: { ...globals },
    imports: shims,
  };

  return await WebAssembly.instantiate(mod, importObject);
}
