const { parse } = require("./parser");
const { emit } = require("./emitter");
const optimizeAst = require("./optimizers/optimize");
const {
  encodef64,
  encodeString,
  encodeVector,
  encodeSection,
  ops,
  unsignedLEB128,
  VAL_TYPE,
  FUNCTION_TYPE,
  GLOBAL_TYPE,
  MUTABILITY,
  TYPE_IDX,
  EXPORT_TYPE,
  SECTION,
} = require("./encoding");
const { localFuncMap } = require("./wasmFunctions");

class NamespaceResolver {
  constructor(initial = []) {
    this._counter = -1;
    this._map = new Map();

    Array.from(initial).forEach(name => this.get(name));
  }
  get(name) {
    if (!this._map.has(name)) {
      this._counter++;
      this._map.set(name, this._counter);
    }
    return this._map.get(name);
  }

  map(cb) {
    return Array.from(this._map.entries()).map(([value, i]) => cb(value, i));
  }
}

function compileModule({
  globals: globalVariables,
  functions: functionCode,
  shims,
  optimize,
  preParsed = false,
}) {
  const functionImports = Object.entries(shims).map(([name, func]) => {
    return {
      args: new Array(func.length).fill(null).map(_ => VAL_TYPE.f64),
      // Shims implicitly always return a number
      returns: [VAL_TYPE.f64],
      name,
    };
  });

  const externalVarsResolver = new NamespaceResolver(globalVariables);
  const userVarsResolver = new NamespaceResolver();
  const localFuncResolver = new NamespaceResolver(
    functionImports.map(func => func.name)
  );

  // TODO: We could pass in the arity here to get a compile-time check that we
  // passed the right number of arguments.
  function resolveLocalFunc(name) {
    // Inline functions
    switch (name) {
      case "abs":
        return [ops.f64_abs];
      case "sqrt":
        return [ops.f64_sqrt];
      case "int":
        return [ops.f64_floor];
      case "min":
        return [ops.f64_min];
      case "max":
        return [ops.f64_max];
      case "above":
        return [ops.f64_lt, ops.f64_convert_i32_s];
      case "below":
        return [ops.f64_gt, ops.f64_convert_i32_s];
      case "equal":
        return [ops.f64_eq, ops.f64_convert_i32_s];
    }
    const offset = localFuncResolver.get(name);
    return [ops.call, ...unsignedLEB128(offset)];
  }

  const moduleFuncs = Object.entries(functionCode).map(([name, code]) => {
    let ast = preParsed ? code : parse(code);
    if (optimize) {
      ast = optimizeAst(ast);
    }
    const binary = emit(ast, {
      globals: globalVariables,
      resolveExternalVar: name => externalVarsResolver.get(name),
      resolveUserVar: name => userVarsResolver.get(name),
      resolveLocalFunc,
      // TODO: Get rid of userVars
      userVars: new Set(),
    });

    return {
      binary,
      exportName: name,
      args: [],
      returns: [],
      locals: [],
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
  // "Functions are referenced through function indices, starting with the smallest index not referencing a function import."
  const functions = [...moduleFuncs, ...localFuncs].map((_, i) => {
    const funcIndex = functionImports.length + i;
    return funcIndex;
  });

  // https://webassembly.github.io/spec/core/binary/modules.html#global-section
  const globals = userVarsResolver.map(() => {
    return [
      VAL_TYPE.f64,
      MUTABILITY.var,
      ops.f64_const,
      ...encodef64(0),
      ops.end,
    ];
  });

  // https://webassembly.github.io/spec/core/binary/modules.html#binary-exportsec
  const xports = [...moduleFuncs].map((func, i) => {
    const funcIndex = i + functionImports.length + localFuncs.length;
    return [...encodeString(func.exportName), EXPORT_TYPE.FUNC, funcIndex];
  });

  // https://webassembly.github.io/spec/core/binary/modules.html#code-section
  const codes = [...localFuncs, ...moduleFuncs].map(func => {
    // TODO: It's a bit odd that every other section is an array of arrays and
    // this one is an array of vectors already.
    return encodeVector([
      ...encodeVector(func.locals),
      ...func.binary,
      ops.end,
    ]);
  });

  return new Uint8Array([
    // Magic module header
    ...[0x00, 0x61, 0x73, 0x6d],
    // Version number
    ...[0x01, 0x00, 0x00, 0x00],
    ...encodeSection(SECTION.TYPE, types),
    ...encodeSection(SECTION.IMPORT, imports),
    ...encodeSection(SECTION.FUNC, functions),
    ...encodeSection(SECTION.GLOBAL, globals),
    ...encodeSection(SECTION.EXPORT, xports),
    ...encodeSection(SECTION.CODE, codes),
  ]);
}

module.exports = { compileModule };
