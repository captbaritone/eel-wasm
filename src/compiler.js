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
  CODE: 10
};

const EXPORT_TYPE = {
  FUNC: 0x00,
  TABLE: 0x01,
  MEMORY: 0x02,
  GLOBAL: 0x03
};

const OPS = {
  i32_const: 0x41,
  f64_const: 0x44,
  f64_mul: 0xa2,
  end: 0x0b,
  drop: 0x1a,
  local_get: 0x20,
  global_set: 0x24,
  global_get: 0x23
};
const VAL_TYPE = {
  i32: 0x7f,
  i64: 0x7e,
  f32: 0x7d,
  f64: 0x7c
};

const MUTABILITY = {
  const: 0x00,
  var: 0x01
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
  ...str.split("").map(s => s.charCodeAt(0))
];

function unsignedLEB128(num) {
  // TODO: Implement this
  return [num];
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

// TODO: Make this a class
function makeNamespaceResolver(initial) {
  let counter = -1;
  const map = new Map();
  const get = name => {
    if (!map.has(name)) {
      counter++;
      map.set(name, counter);
    }
    return map.get(name);
  };

  Array.from(initial).forEach(get);

  get.map = cb => {
    const arr = [];
    for (let i = 0; i < counter; i++) {
      arr[i] = cb(map.get(i), i);
    }
    return arr;
  };
  return get;
}

function compileModule({
  globals: globalVariables,
  functions: functionCode,
  shims,
  optimize
}) {
  const functionImports = Object.entries(shims).map(([name, func]) => {
    return {
      args: new Array(func.length).fill(null).map(_ => VAL_TYPE.f64),
      // Shims implicitly always return a number
      returns: [VAL_TYPE.f64],
      name
    };
  });
  // TODO: Merge these
  // Imported globals must come first, so we pre-seed the namespace with the "globals".
  const resolveExternalVar = (resolveUserVar = makeNamespaceResolver(
    globalVariables
  ));

  const moduleFuncs = Object.entries(functionCode).map(([name, code]) => {
    let ast = parse(code);
    if (optimize) {
      ast = optimizeAst(ast);
    }
    const binary = emit(ast, {
      globals: globalVariables,
      resolveExternalVar,
      resolveUserVar,
      // TODO: Get rid of userVars
      userVars: new Set()
    });

    return {
      binary,
      exportName: name,
      args: [],
      returns: [],
      locals: []
    };
  });

  const localFuncs = [
    {
      args: [VAL_TYPE.f64],
      returns: [VAL_TYPE.f64],
      locals: [],
      binary: [
        OPS.local_get,
        ...unsignedLEB128(0),
        OPS.local_get,
        ...unsignedLEB128(0),
        OPS.f64_mul
      ],
      exportName: "sqr",
      name: "sqr"
    }
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#type-section
  // TODO: Theoretically we could merge identiacal type definitions
  const types = [
    ...functionImports.map(func => {
      return [
        FUNCTION_TYPE,
        // Vector of args
        ...encodeVector(func.args),
        // Vector of returns (currently may be at most one)
        ...encodeVector(func.returns)
      ];
    }),
    ...moduleFuncs.map(func => {
      return [
        FUNCTION_TYPE,
        // Vector of args
        ...encodeVector(func.args),
        // Vector of returns (currently may be at most one)
        ...encodeVector(func.returns)
      ];
    })
    /*
    // This might be omitted from the compiled version because it matches a previous function type
    ...localFuncs.map(func => {
      return [
        FUNCTION_TYPE,
        // Vector of args
        ...encodeVector(func.args),
        // Vector of returns (currently may be at most one)
        ...encodeVector(func.returns)
      ];
    })
    */
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#import-section
  const imports = [
    // Somehow these implicitly map to the first n indexes of the globals section?
    ...Array.from(globalVariables).map(name => {
      return [
        ...encodeString("js"),
        ...encodeString(name),
        ...[GLOBAL_TYPE, VAL_TYPE.f64, MUTABILITY.var]
      ];
    }),
    ...functionImports.map((func, i) => {
      return [
        ...encodeString("imports"),
        ...encodeString(func.name),
        // TODO: Get i from a registry
        ...[TYPE_IDX, i]
      ];
    })
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#function-section
  // "Functions are referenced through function indices, starting with the smallest index not referencing a function import."
  // TODO: Get this index from a registry
  const _functions = [...moduleFuncs, ...localFuncs].map(
    (_, i) => i + functionImports.length
  );

  const functions = [
    // run (export)
    0,
    // sqr (local)
    2
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#global-section
  const globals = resolveExternalVar.map(global => {
    return [
      VAL_TYPE.f64,
      MUTABILITY.var,
      OPS.f64_const,
      ...encodeNumber(0),
      OPS.end
    ];
  });

  // https://webassembly.github.io/spec/core/binary/modules.html#binary-exportsec
  const xports = [...moduleFuncs].map((func, i) => {
    // TODO: Get this index from a registry
    // TODO: FIXME
    const funcIndex = i + functionImports.length + 1;
    return [...encodeString(func.exportName), EXPORT_TYPE.FUNC, funcIndex];
  });

  // https://webassembly.github.io/spec/core/binary/modules.html#code-section
  const codes = [...localFuncs, ...moduleFuncs].map(func => {
    return encodeVector([
      // vector of locals
      ...encodeVector(func.locals),
      ...func.binary,
      OPS.end
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
    ...encodeSection(SECTION.CODE, codes)
  ]);
}

function compileModuleWat({ globals, functions, optimize = false }) {
  const exportedFunctions = Object.entries(functions).map(
    ([functionName, expression]) => {
      return {
        type: "FUNCTION_EXPORT",
        name: functionName,
        function: parse(expression)
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