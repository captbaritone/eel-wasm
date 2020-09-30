import shims from "./shims";
import { compileModule } from "./compiler";
import { EelVersion } from "./types";

type LoadModuleOptions = {
  pools: {
    [name: string]: {
      [name: string]: WebAssembly.Global;
    };
  };
  functions: {
    [name: string]: {
      pool: string;
      code: string;
    };
  };
  eelVersion?: EelVersion;
};

export async function loadModule({
  pools,
  functions,
  eelVersion = 2,
}: LoadModuleOptions) {
  let compilerPools: { [name: string]: Set<string> } = {};
  Object.entries(pools).forEach(([key, globals]) => {
    compilerPools[key] = new Set(Object.keys(globals));
  });
  const buffer = compileModule({
    pools: compilerPools,
    functions,
    eelVersion,
  });
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    ...pools,
    shims,
  };

  return await WebAssembly.instantiate(mod, importObject);
}
