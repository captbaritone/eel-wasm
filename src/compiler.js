const { parse } = require("./parser");
const { emit, BINARY } = require("./emitter");
const ieee754 = require("ieee754");
const optimizeAst = require("./optimizers/optimize");
const wabt = require("wabt")();

// An intial attempt to construct a Wasm binary by hand.
/*
0	custom section
1	type section
2	import section
3	function section
4	table section
5	memory section
6	global section
7	export section
8	start section
9	element section
10	code section
11	data section
*/
// https://webassembly.github.io/spec/core/binary/modules.html#sections
const SECTION = {
  TYPE: 1,
  IMPORT: 2,
  FUNC: 3,
  GLOBAL: 6,
  EXPORT: 7,
  CODE: 10,
};

const EXPORT_TYPE = {
  FUNC: 0x00,
  TABLE: 0x01,
  MEMORY: 0x02,
  GLOBAL: 0x03,
};

const OPS = {
  i32_const: 0x41,
  f64_const: 0x44,
  f64_mul: 0xa2,
  end: 0x0b,
  drop: 0x1a,
  local_get: 0x20,
  global_set: 0x24,
  global_get: 0x23,
};
const VAL_TYPE = {
  i32: 0x7f,
  i64: 0x7e,
  f32: 0x7d,
  f64: 0x7c,
};

const MUTABILITY = {
  const: 0x00,
  var: 0x01,
};

// http://webassembly.github.io/spec/core/binary/types.html#function-types
const FUNCTION_TYPE = 0x60;
// I think these might actually be specific to importdesc
const GLOBAL_TYPE = 0x03;
const TYPE_IDX = 0x00;

// f64
function encodeNumber(num) {
  const arr = new Uint8Array(8);
  ieee754.write(arr, num, 0, true, 52, 8);
  return arr;
}

const encodeString = str => [
  str.length,
  ...str.split("").map(s => s.charCodeAt(0)),
];

function unsignedLEB128(n) {
  const buffer = [];
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n !== 0) {
      byte |= 0x80;
    }
    buffer.push(byte);
  } while (n !== 0);
  return buffer;
}

const flatten = arr => [].concat.apply([], arr);

// https://webassembly.github.io/spec/core/binary/conventions.html#binary-vec
// Vectors are encoded with their length followed by their element sequence
const encodeVector = data => [...unsignedLEB128(data.length), ...flatten(data)];

// subSections is an array of arrays
function encodeSection(type, subSections) {
  // Sections are all optional, so if we get an empty vector of subSections, we
  // can omit the whole section.
  if (subSections.length === 0) {
    return [];
  }

  // The size of this vector is not needed for decoding, but can be
  // used to skip sections when navigating through a binary.
  return [type, ...encodeVector(encodeVector(subSections))];
}

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

const localFuncMap = {
  sqr: {
    args: [VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    locals: [],
    binary: [
      OPS.local_get,
      ...unsignedLEB128(0),
      OPS.local_get,
      ...unsignedLEB128(0),
      OPS.f64_mul,
    ],
  },
};

function compileModule({
  globals: globalVariables,
  functions: functionCode,
  shims,
  optimize,
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

  const moduleFuncs = Object.entries(functionCode).map(([name, code]) => {
    let ast = parse(code);
    if (optimize) {
      ast = optimizeAst(ast);
    }
    const binary = emit(ast, {
      globals: globalVariables,
      resolveExternalVar: name => externalVarsResolver.get(name),
      resolveUserVar: name => userVarsResolver.get(name),
      resolveLocalFunc: name => localFuncResolver.get(name),
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
      OPS.f64_const,
      ...encodeNumber(0),
      OPS.end,
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
      OPS.end,
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

function compileModuleWat({ globals, functions, optimize = false }) {
  const exportedFunctions = Object.entries(functions).map(
    ([functionName, expression]) => {
      return {
        type: "FUNCTION_EXPORT",
        name: functionName,
        function: parse(expression),
      };
    }
  );

  let ast = { type: "MODULE", exportedFunctions };
  if (optimize) {
    ast = optimizeAst(ast);
  }
  const wat = emit(ast, { globals });
  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer } = wasmModule.toBinary({});
  return buffer;
}

module.exports = { compileModule: BINARY ? compileModule : compileModuleWat };
