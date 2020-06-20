import shims from "./shims";
import { compileModule } from "./compiler";

type LoadModuleOptions = {
  pools: {
    [name: string]: {
      globals: { [name: string]: WebAssembly.Global };
      functions: { [name: string]: string };
    };
  };
};

type Pool = {
  globals: Set<string>;
  functions: { [name: string]: string };
};

export async function loadModule({ pools }: LoadModuleOptions) {
  let compilerPools: { [name: string]: Pool } = {};
  Object.entries(pools).forEach(([key, value]) => {
    compilerPools[key] = {
      globals: new Set(Object.keys(value.globals)),
      functions: value.functions,
    };
  });
  const buffer = compileModule({
    pools: compilerPools,
  });
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    main: pools.main.globals,
    shims,
  };

  return await WebAssembly.instantiate(mod, importObject);
}
