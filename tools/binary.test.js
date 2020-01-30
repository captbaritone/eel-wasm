const { parse } = require("../src/parser");
const { emit } = require("../src/emitter");
const wabt = require("wabt")();
const ieee754 = require("ieee754");

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
  end: 0x0b,
  drop: 0x1a,
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
const GLOBAL_TYPE = 0x03;

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

// An attempt at generating Wasm binary directly (without the help fo wabt)
test.skip("Can execute hand crafted binary Wasm", async () => {
  const magicModuleHeader = [0x00, 0x61, 0x73, 0x6d];
  const moduleVersion = [0x01, 0x00, 0x00, 0x00];

  const runTypeSignature = [
    FUNCTION_TYPE,
    // Vector of args
    ...encodeVector([]),
    // Vector of returns (currently may be at most one)
    ...encodeVector([])
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#type-section
  const typeSection = [
    SECTION.TYPE,
    ...encodeVector(encodeVector([runTypeSignature]))
  ];

  const runFunction = [
    // Offset into types
    0x00
  ];

  const funcs = encodeVector([runFunction]);

  // https://webassembly.github.io/spec/core/binary/modules.html#function-section
  const gGlobal = [
    VAL_TYPE.f64,
    MUTABILITY.var,
    OPS.f64_const,
    ...encodeNumber(0),
    OPS.end
  ];

  const globals = encodeVector([gGlobal]);

  const globalSection = [SECTION.GLOBAL, ...encodeVector(globals)];

  const runFunctionFunctionIndex = 0; // Offset
  const runFunctionExportDescription = EXPORT_TYPE.FUNC;

  const runExport = [
    ...encodeString("run"),
    runFunctionExportDescription,
    runFunctionFunctionIndex
  ];
  const expts = encodeVector([runExport]);

  // https://webassembly.github.io/spec/core/binary/modules.html#binary-exportsec
  const exportSection = [SECTION.EXPORT, ...encodeVector(expts)];

  // This outer vector adds the "size" of the code.
  //
  // "Like with sections, the code size is not needed for decoding, but can be
  // used to skip functions when navigating through a binary. The module is
  // malformed if a size does not match the length of the respective function
  // code."

  function makeNamespaceResolver(prefix) {
    let counter = -1;
    const map = new Map();
    return name => {
      if (!map.has(name)) {
        counter++;
        map.set(name, counter);
      }
      return counter;
    };
  }

  const funcSection = [SECTION.FUNC, ...encodeVector(funcs)];
  const program = parse("g = 100;");
  const resolveExternalVar = makeNamespaceResolver();
  const code = emit(program, { globals: new Set(["g"]), resolveExternalVar });

  const runCode = encodeVector([
    // vector of locals
    ...encodeVector([]),
    ...code,
    OPS.end
  ]);
  const codes = encodeVector([runCode]);

  // https://webassembly.github.io/spec/core/binary/modules.html#code-section
  const codeSection = [SECTION.CODE, ...encodeVector(codes)];

  const gImport = [
    ...encodeString("js"),
    ...encodeString("g"),
    ...[GLOBAL_TYPE, VAL_TYPE.f64, MUTABILITY.var]
  ];

  const imports = encodeVector([gImport]);

  const importSection = [SECTION.IMPORT, ...encodeVector(imports)];

  const buffer = new Uint8Array([
    ...magicModuleHeader,
    ...moduleVersion,
    ...typeSection,
    ...importSection,
    ...funcSection,
    ...globalSection,
    ...exportSection,
    ...codeSection
  ]);

  const wat = `(module
    (global $E0 (import "js" "g") (mut f64))
    (global $U0 (mut f64) f64.const 0)
    (func 
        f64.const 100
        global.set $E0
        global.get $E0
        drop
    )
    (export "run" (func 0))
  )`;
  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer: minimal } = wasmModule.toBinary({});

  function toHex(arr) {
    return Array.from(arr).map(val =>
      val
        .toString(16)
        .padStart(2, 0)
        .toUpperCase()
    );
  }

  expect(toHex(buffer)).toEqual(toHex(minimal));

  var importObject = {
    js: {
      g: new WebAssembly.Global({ value: "f64", mutable: true }, 0)
    }
  };

  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod, importObject);
  instance.exports.run();
  expect(importObject.js.g.value).toBe(100);
});
