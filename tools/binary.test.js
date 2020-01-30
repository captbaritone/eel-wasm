// An intial attempt to construct a Wasm binary by hand.
const SECTION = {
  TYPE: 1,
  FUNC: 3,
  CODE: 6,
  EXPORT: 7
};

const EXPORT_TYPE = {
  FUNC: 0x00,
  TABLE: 0x01,
  MEMORY: 0x02,
  GLOBAL: 0x03
};

const OPS = {
  i32_const: 0x41,
  end: 0x0b
};
const VAL_TYPE = {
  i32: 0x7f,
  f32: 0x7d
};

// http://webassembly.github.io/spec/core/binary/types.html#function-types
const FUNCTION_TYPE = 0x60;

function encodeNumber(num) {
  return num;
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
test.only("Can execute hand crafted binary Wasm", async () => {
  const magicModuleHeader = [0x00, 0x61, 0x73, 0x6d];
  const moduleVersion = [0x01, 0x00, 0x00, 0x00];

  const runTypeSignature = [
    FUNCTION_TYPE,
    // Vector of args
    ...encodeVector([]),
    // Vector of returns (currently may be at most one)
    ...encodeVector([VAL_TYPE.i32])
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

  const runExport = [...encodeString("run"), EXPORT_TYPE.FUNC, 0x00, 0x0a];

  // the export section is a vector of exported functions
  const exportSection = [SECTION.EXPORT, ...encodeVector([runExport])];

  const codeSection = [
    SECTION.CODE,
    ...encodeVector([
      encodeVector([
        // vector of locals
        ...encodeVector([]),
        // Code proper
        ...[OPS.i32_const, encodeNumber(10)],
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

  const mod = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(mod);
  const result = instance.exports.run();
  expect(result).toBe(10);
});
