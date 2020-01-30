const { parse } = require("../src/parser");
const { emit } = require("../src/emitter");
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
  FUNC: 3,
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

// http://webassembly.github.io/spec/core/binary/types.html#function-types
const FUNCTION_TYPE = 0x60;

function encodeNumber(num) {
  if (num === 10) {
    return new Uint8Array([0, 0, 0, 0, 0, 0, 0x24, 0x40]);
  }
  throw new Error("I don't know how to generate binary for floats yet");
}

test("Encode float 64", () => {
  expect(encodeNumber(10)).toEqual(
    new Uint8Array([0, 0, 0, 0, 0, 0, 0x24, 0x40])
  );
});

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
      10,
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

  const typeSection = [
    SECTION.TYPE,
    ...encodeVector(encodeVector([runTypeSignature]))
  ];

  const funcSection = [
    SECTION.FUNC,
    0x02, // Vector length?
    0x01,
    0x00,
    0x07
  ];

  const runExport = [...encodeString("run"), EXPORT_TYPE.FUNC, 0x00];

  // the export section is a vector of exported functions
  const exportSection = [SECTION.EXPORT, ...encodeVector([runExport])];

  const codeSection = [
    SECTION.CODE,
    0x0d, // WAT?
    ...encodeVector([
      encodeVector([
        // vector of locals
        ...encodeVector([]),
        // Code proper
        ...[OPS.f64_const, ...encodeNumber(10)],
        OPS.end
      ])
    ])
  ];

  const buffer = new Uint8Array([
    ...magicModuleHeader,
    ...moduleVersion,
    ...typeSection,
    ...funcSection,
    ...exportSection,
    ...codeSection
  ]);

  const wat = `(module
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
