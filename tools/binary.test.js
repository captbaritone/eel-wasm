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
  end: 0x0b
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

// This test only passes when BINARY=true in emitter.js
test.skip("Can emit binary (eventually)", () => {
  const program = parse("10;");
  expect(program).toMatchInlineSnapshot(`
    Object {
      "body": Array [
        Object {
          "column": 0,
          "line": 1,
          "type": "NUMBER_LITERAL",
          "value": 10,
        },
      ],
      "column": 0,
      "line": 1,
      "type": "SCRIPT",
    }
  `);
  expect(new Uint8Array(emit(program))).toMatchInlineSnapshot(`
    Uint8Array [
      68,
      0,
      0,
      0,
      0,
      0,
      0,
      36,
      64,
      26,
    ]
  `);
});

// An attempt at generating Wasm binary directly (without the help fo wabt)
test("Can execute hand crafted binary Wasm", async () => {
  const magicModuleHeader = [0x00, 0x61, 0x73, 0x6d];
  const moduleVersion = [0x01, 0x00, 0x00, 0x00];

  const runTypeSignature = [
    FUNCTION_TYPE,
    // Vector of args
    ...encodeVector([]),
    // Vector of returns (currently may be at most one)
    ...encodeVector([VAL_TYPE.f64])
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#type-section
  const typeSection = [
    SECTION.TYPE,
    ...encodeVector(encodeVector([runTypeSignature]))
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#function-section
  // This makes no sense. It should be a vector of length one containing a single value 0.
  const funcSection = [
    SECTION.FUNC,
    0x02, // Vector length?
    0x01,
    0x00
    // 0x07 // Could this actually be the secion type for export?
  ];

  const gGlobal = [
    // globalType
    0x01, // WAT?
    VAL_TYPE.f64,
    MUTABILITY.var,
    OPS.f64_const,
    ...encodeNumber(0),
    OPS.end
  ];

  const globalSection = [SECTION.GLOBAL, ...encodeVector([...gGlobal])];

  const runFunctionFunctionIndex = 0; // Offset
  const runFunctionExportDescription = EXPORT_TYPE.FUNC;

  const runExport = [
    ...encodeString("run"),
    runFunctionExportDescription,
    runFunctionFunctionIndex
  ];

  // https://webassembly.github.io/spec/core/binary/modules.html#binary-exportsec
  const exportSection = [SECTION.EXPORT, ...encodeVector([runExport])];

  // This outer vector adds the "size" of the code.
  //
  // "Like with sections, the code size is not needed for decoding, but can be
  // used to skip functions when navigating through a binary. The module is
  // malformed if a size does not match the length of the respective function
  // code."
  const runCode = encodeVector([
    // vector of locals
    ...encodeVector([]),
    // Code proper
    OPS.f64_const,
    ...encodeNumber(10),
    // End
    OPS.end
  ]);
  const codes = encodeVector([runCode]);

  // https://webassembly.github.io/spec/core/binary/modules.html#code-section
  const codeSection = [SECTION.CODE, ...encodeVector(codes)];

  const buffer = new Uint8Array([
    ...magicModuleHeader,
    ...moduleVersion,
    ...typeSection,
    ...funcSection,
    ...globalSection,
    0x07, // WAT?
    ...exportSection,
    ...codeSection
  ]);

  const wat = `(module
    (global $U0 (mut f64) f64.const 0)
    (func (result f64)
        f64.const 10
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

  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod);
  const result = instance.exports.run();
  expect(result).toBe(10);
});
