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
  CODE: 10,
};

const EXPORT_TYPE = {
  FUNC: 0x00,
  TABLE: 0x01,
  MEMORY: 0x02,
  GLOBAL: 0x03,
};

const op = {
  block: 0x02,
  loop: 0x03,
  br: 0x0c,
  br_if: 0x0d,
  select: 0x1b,
  call: 0x10,
  drop: 0x1a,
  i32_or: 0x72,
  i32_const: 0x41,
  i32_ne: 0x47,
  i32_sub: 0x6b,
  i32_eqz: 0x45,
  i32_trunc_s_f64: 0xaa,
  i64_and: 0x83,
  i64_or: 0x84,
  i64_rem_s: 0x81,
  f64_const: 0x44,
  f64_ne: 0x62,
  f64_neg: 0x9a,
  f64_add: 0xa0,
  f64_sub: 0xa1,
  f64_mul: 0xa2,
  f64_div: 0xa3,
  f64_abs: 0x99,
  f64_sqrt: 0x9f,
  f64_floor: 0x9c,
  f64_min: 0xa4,
  f64_max: 0xa5,
  f64_gt: 0x64,
  f64_eq: 0x61,
  f64_lt: 0x63,
  f64_le: 0x65,
  f64_ge: 0x66,
  i64_trunc_s_f64: 0xb0,
  f64_convert_s_i64: 0xb9,
  f64_convert_i32_s: 0xb7,
  if: 0x04,
  else: 0x05,
  end: 0x0b,
  local_get: 0x20,
  local_set: 0x21,
  local_tee: 0x22,
  global_get: 0x23,
  global_set: 0x24,
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

const BLOCK = {
  void: 0x40,
};

function assertNumbers(nums) {
  nums.forEach((num, i) => {
    if (typeof num != "number") {
      throw new Error(`Found non-number at index ${i}. Got ${typeof num}`);
    }
  });
  return nums;
}

// http://webassembly.github.io/spec/core/binary/types.html#function-types
const FUNCTION_TYPE = 0x60;
// I think these might actually be specific to importdesc
const GLOBAL_TYPE = 0x03;
const TYPE_IDX = 0x00;

// f64
function encodef64(num) {
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
  // TODO: Remove this assertion once we are more confident in our output.
  return [type, ...assertNumbers(encodeVector(encodeVector(subSections)))];
}

module.exports = {
  encodeVector,
  encodeSection,
  encodeString,
  unsignedLEB128,
  encodef64,
  op,
  assertNumbers,
  VAL_TYPE,
  GLOBAL_TYPE,
  FUNCTION_TYPE,
  MUTABILITY,
  TYPE_IDX,
  EXPORT_TYPE,
  SECTION,
  BLOCK,
};
