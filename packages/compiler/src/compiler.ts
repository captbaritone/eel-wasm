import { parse } from "./parser";
import { emit } from "./emitter";
import {
  encodeString,
  encodeNestedVector,
  encodeSection,
  op,
  unsignedLEB128,
  VAL_TYPE,
  FUNCTION_TYPE,
  GLOBAL_TYPE,
  MUTABILITY,
  TYPE_IDX,
  EXPORT_TYPE,
  SECTION,
  MAGIC,
  WASM_VERSION,
  encodeFlatVector,
} from "./encoding";
import shims from "./shims";
import * as Utils from "./utils";
import { localFuncMap } from "./wasmFunctions";
import { CompilerContext, TypedFunction, EelVersion } from "./types";
import { WASM_MEMORY_SIZE } from "./constants";

type CompilerOptions = {
  pools: {
    [name: string]: Set<string>;
  };
  functions: {
    [name: string]: {
      pool: string;
      code: string;
    };
  };
  eelVersion?: EelVersion;
  preParsed?: boolean;
};

export function compileModule({
  pools,
  functions: funcs,
  eelVersion = 2,
  preParsed = false,
}: CompilerOptions) {
  if (Object.keys(pools).includes("shims")) {
    throw new Error(
      'You may not name a pool "shims". "shims" is reserved for injected JavaScript functions.'
    );
  }

  // Collect all the globals that we expect to get as imports.
  const importedVars: [string, string][] = [];
  Object.entries(pools).forEach(([poolName, pool]) => {
    pool.forEach(variableName => {
      importedVars.push([poolName, variableName]);
    });
  });

  // Ensure all the imported globals get the first ids.
  const varResolver = new Utils.ScopedIdMap();
  importedVars.forEach(([poolName, variableName]) => {
    varResolver.get(poolName, variableName);
  });

  const functionImports = Object.entries(shims).map(([name, func]) => {
    return {
      args: new Array(func.length).fill(null).map(_ => VAL_TYPE.f64),
      // Shims implicitly always return a number
      returns: [VAL_TYPE.f64],
      name,
    };
  });

  const localFuncOrder: string[] = [];

  const moduleFuncs: {
    binary: number[];
    exportName: string;
    args: never[];
    returns: never[];
    localVariables: number[];
  }[] = [];

  Object.entries(funcs).forEach(([name, { pool, code }]) => {
    if (pools[pool] == null) {
      const poolsList = Object.keys(pools);
      if (poolsList.length === 0) {
        throw new Error(
          `The function "${name}" was declared as using a variable ` +
            `pool named "${pool}" but no pools were defined.`
        );
      }
      throw new Error(
        `The function "${name}" was declared as using a variable ` +
          `pool named "${pool}" which is not among the variable ` +
          `pools defined. The defined variable pools are: ` +
          `${Utils.formatList(poolsList)}.`
      );
    }
    const ast = preParsed ? code : parse(code);
    if (typeof ast === "string") {
      // TODO: Change the API so this can be enforced by types
      throw new Error(
        "Got passed unparsed code without setting the preParsed flag"
      );
    }
    if (ast.type !== "SCRIPT") {
      throw new Error("Invalid AST");
    }
    if (ast.body.length === 0) {
      return;
    }
    const localVariables: number[] = [];
    const context: CompilerContext = {
      resolveVar: name => {
        // The `reg00`-`reg99` variables are special in that they are shared between all pools.
        if (/^reg\d\d$/.test(name)) {
          return varResolver.get(null, name);
        }
        return varResolver.get(pool, name);
      },
      resolveLocal: type => {
        // TODO: We could provide a way for the emitter to release a local
        // variable so that we can reuse it, much in the same way a traditional
        // compiler does in register allocation.
        localVariables.push(type);
        return localVariables.length - 1;
      },
      resolveFunc: name => {
        // If this is a shim, return the shim index.
        const shimdex = functionImports.findIndex(func => func.name === name);
        if (shimdex !== -1) {
          const call = op.call(shimdex);
          if (name === "rand" && eelVersion === 1) {
            return [...call, op.f64_floor];
          }
          return call;
        }

        // If it's not a shim and it's not a defined function, return null.
        // The emitter will generate a nice error.
        if (localFuncMap[name] == null) {
          return null;
        }
        let index = localFuncOrder.indexOf(name);
        if (index === -1) {
          localFuncOrder.push(name);
          index = localFuncOrder.length - 1;
        }
        return op.call(index + functionImports.length);
      },
      rawSource: code,
    };
    const binary = emit(ast, context);

    moduleFuncs.push({
      binary,
      exportName: name,
      args: [],
      returns: [],
      localVariables,
    });
  });

  const localFuncs = localFuncOrder.map(name => {
    const func = localFuncMap[name];
    // This check is technically redundant since we check inside resolveLocalFunc
    // in the compiler context. It's here just to catch potential compiler bugs.
    if (func == null) {
      throw new Error(`Undefined local function "${name}"`);
    }
    return func;
  });

  // Given a function definition, return a hashable string representation of its signature.
  const getSignatureKey = (func: TypedFunction) => {
    return [...func.args, "|", ...func.returns].join("-");
  };

  // https://webassembly.github.io/spec/core/binary/modules.html#type-section
  const types: number[][] = [];
  const typeIndexByKey: Map<string, number> = new Map();
  [...functionImports, ...localFuncs, ...moduleFuncs].forEach(func => {
    const key = getSignatureKey(func);
    if (typeIndexByKey.has(key)) {
      return;
    }
    types.push([
      FUNCTION_TYPE,
      ...encodeFlatVector(func.args),
      ...encodeFlatVector(func.returns),
    ]);
    typeIndexByKey.set(key, types.length - 1);
  });

  function getTypeIndex(func: TypedFunction): number {
    const key = getSignatureKey(func);
    const typeIndex = typeIndexByKey.get(key);
    if (typeIndex == null) {
      throw new Error(`Failed to get a type index for key ${key}`);
    }
    return typeIndex;
  }

  // https://webassembly.github.io/spec/core/binary/modules.html#import-section
  const imports = [
    ...importedVars.map(([namespace, name]) => {
      return [
        ...encodeString(namespace),
        ...encodeString(name),
        ...[GLOBAL_TYPE, VAL_TYPE.f64, MUTABILITY.var],
      ];
    }),
    ...functionImports.map((func, i) => {
      const typeIndex = getTypeIndex(func);
      return [
        ...encodeString("shims"),
        ...encodeString(func.name),
        ...[TYPE_IDX, ...unsignedLEB128(typeIndex)],
      ];
    }),
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#function-section
  //
  // > Functions are referenced through function indices, starting with the smallest
  // > index not referencing a function import.
  const functions = [...localFuncs, ...moduleFuncs].map(func => {
    const typeIndex = getTypeIndex(func);
    return unsignedLEB128(typeIndex);
  });

  const memories = [
    // Only one memory
    [
      0x01, // Indicates that we are specifying two values (initial/max)
      ...unsignedLEB128(WASM_MEMORY_SIZE), // Initial size
      ...unsignedLEB128(WASM_MEMORY_SIZE), // Max size
    ],
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#global-section
  const globalCount = varResolver.size() - importedVars.length;
  const globals = Utils.times(globalCount, () => {
    return [
      VAL_TYPE.f64, // All eel values are float 64s
      MUTABILITY.var, // All globals are mutable
      ...op.f64_const(0), // Initialize the global to zero
      op.end, // All done
    ];
  });

  // https://webassembly.github.io/spec/core/binary/modules.html#binary-exportsec
  const xports = [...moduleFuncs].map((func, i) => {
    const funcIndex = i + functionImports.length + localFuncs.length;
    return [
      ...encodeString(func.exportName),
      EXPORT_TYPE.FUNC,
      ...unsignedLEB128(funcIndex),
    ];
  });

  /* Uncomment this to expose memory
  xports.push([
    ...encodeString("memory"),
    EXPORT_TYPE.MEMORY,
    ...unsignedLEB128(0),
  ]);
  */

  // https://webassembly.github.io/spec/core/binary/modules.html#code-section
  const codes = [...localFuncs, ...moduleFuncs].map(func => {
    // TODO: We could collapse consecutive types here, or even move to a two
    // pass approach where ids are resolved after the emitter is run.
    const localTypes = (func.localVariables ?? []).map(type => {
      return [...unsignedLEB128(1), type];
    });
    // It's a bit odd that every other section is an array of arrays and this
    // one is an array of vectors. The spec says this is so that when navigating
    // the binary functions can be skipped efficiently.
    return encodeFlatVector([
      ...encodeNestedVector(localTypes),
      ...func.binary,
      op.end,
    ]);
  });
  return new Uint8Array([
    // Magic module header
    ...MAGIC,
    // Version number
    ...WASM_VERSION,
    ...encodeSection(SECTION.TYPE, types),
    ...encodeSection(SECTION.IMPORT, imports),
    ...encodeSection(SECTION.FUNC, functions),
    ...encodeSection(SECTION.MEMORY, memories),
    ...encodeSection(SECTION.GLOBAL, globals),
    ...encodeSection(SECTION.EXPORT, xports),
    ...encodeSection(SECTION.CODE, codes),
  ]);
}
