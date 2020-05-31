import { parse } from "./parser";
import { emit } from "./emitter";
import {
  encodef64,
  encodeString,
  encodeVector,
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
} from "./encoding";
import shims from "./shims";
import { localFuncMap } from "./wasmFunctions";
import { CompilerContext } from "./types";

class NamespaceResolver {
  _counter: number;
  _map: Map<string, number>;
  constructor(initial: string[] = [], offset = 0) {
    this._counter = -1 + offset;
    this._map = new Map();

    initial.forEach(name => this.get(name));
  }
  get(name: string): number {
    if (!this._map.has(name)) {
      this._counter++;
      this._map.set(name, this._counter);
    }
    // @ts-ignore we just set this.
    return this._map.get(name);
  }

  map<T>(cb: (value: string, i: number) => T): T[] {
    return Array.from(this._map.entries()).map(([value, i]) => cb(value, i));
  }
}

type CompilerOptions = {
  globals: Set<string>;
  functions: { [name: string]: string };
  preParsed?: boolean;
};

export function compileModule({
  globals: globalVariables,
  functions: functionCode,
  preParsed = false,
}: CompilerOptions) {
  const functionImports = Object.entries(shims).map(([name, func]) => {
    return {
      args: new Array(func.length).fill(null).map(_ => VAL_TYPE.f64),
      // Shims implicitly always return a number
      returns: [VAL_TYPE.f64],
      name,
    };
  });

  const externalVarsResolver = new NamespaceResolver(
    Array.from(globalVariables)
  );
  const userVarsResolver = new NamespaceResolver([], globalVariables.size);
  const localFuncResolver = new NamespaceResolver(
    functionImports.map(func => func.name)
  );

  const moduleFuncs = Object.entries(functionCode).map(([name, code]) => {
    const ast = preParsed ? code : parse(code);
    if (typeof ast === "string") {
      // TODO: Change the API so this can be enforced by types
      throw new Error(
        "Got passed unparsed code without setting the preParsed flag"
      );
    }

    const localVariables: number[] = [];
    const context: CompilerContext = {
      resolveVar: name => {
        if (globalVariables.has(name)) {
          return externalVarsResolver.get(name);
        }
        return userVarsResolver.get(name);
      },
      resolveLocal: type => {
        localVariables.push(type);
        return localVariables.length - 1;
      },
      resolveLocalFunc: name => {
        if (shims[name] == null && localFuncMap[name] == null) {
          return null;
        }
        const offset = localFuncResolver.get(name);
        return op.call(offset);
      },
      rawSource: code,
    };
    const binary = emit(ast, context);

    return {
      binary,
      exportName: name,
      args: [],
      returns: [],
      localVariables,
    };
  });

  const localFuncs = localFuncResolver
    .map(name => name)
    // TODO: This .slice es muy grosso.
    .slice(functionImports.length)
    .map(name => {
      const func = localFuncMap[name];
      if (func == null) {
        throw new Error(`Undefined local function "${name}"`);
      }
      return func;
    });

  // https://webassembly.github.io/spec/core/binary/modules.html#type-section
  // TODO: Theoretically we could merge identiacal type definitions
  const types = [...functionImports, ...localFuncs, ...moduleFuncs].map(
    func => {
      return [
        FUNCTION_TYPE,
        ...encodeVector(func.args),
        ...encodeVector(func.returns),
      ];
    }
  );

  // https://webassembly.github.io/spec/core/binary/modules.html#import-section
  const imports = [
    // Somehow these implicitly map to the first n indexes of the globals section?
    ...Array.from(globalVariables).map(name => {
      return [
        ...encodeString("js"),
        ...encodeString(name),
        ...[GLOBAL_TYPE, VAL_TYPE.f64, MUTABILITY.var],
      ];
    }),
    ...functionImports.map((func, i) => {
      return [
        ...encodeString("imports"),
        ...encodeString(func.name),
        ...[TYPE_IDX, i],
      ];
    }),
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#function-section
  //
  // > Functions are referenced through function indices, starting with the smallest
  // > index not referencing a function import.
  const functions = [...moduleFuncs, ...localFuncs].map((_, i) => {
    const funcIndex = functionImports.length + i;
    return [funcIndex];
  });

  const memories = [
    // Only one memory
    // TODO: What size should this be?
    [...unsignedLEB128(0), ...unsignedLEB128(1000)],
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#global-section
  const globals = userVarsResolver.map(() => {
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
    return [...encodeString(func.exportName), EXPORT_TYPE.FUNC, funcIndex];
  });

  // https://webassembly.github.io/spec/core/binary/modules.html#code-section
  const codes = [...localFuncs, ...moduleFuncs].map(func => {
    // TODO: We could collapose consecutive types here, or even move to a two
    // pass approach where ids are resolved after the emitter is run.
    const localTypes = (func.localVariables ?? []).map(type => {
      return [...unsignedLEB128(1), type];
    });
    // It's a bit odd that every other section is an array of arrays and this
    // one is an array of vectors. The spec says this is so that when navigating
    // the binary functions can be skipped efficiently.
    return encodeVector([...encodeVector(localTypes), ...func.binary, op.end]);
  });

  return new Uint8Array([
    // Magic module header
    ...[0x00, 0x61, 0x73, 0x6d],
    // Version number
    ...[0x01, 0x00, 0x00, 0x00],
    ...encodeSection(SECTION.TYPE, types),
    ...encodeSection(SECTION.IMPORT, imports),
    ...encodeSection(SECTION.FUNC, functions),
    ...encodeSection(SECTION.MEMORY, memories),
    ...encodeSection(SECTION.GLOBAL, globals),
    ...encodeSection(SECTION.EXPORT, xports),
    ...encodeSection(SECTION.CODE, codes),
  ]);
}
