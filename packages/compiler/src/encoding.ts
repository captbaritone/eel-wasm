import * as ieee754 from "./ieee754.js";
import { flatten } from "./utils.js";

export const MAGIC = [0x00, 0x61, 0x73, 0x6d];
export const WASM_VERSION = [0x01, 0x00, 0x00, 0x00];

export const EPSILON = 0.00001;

// An initial attempt to construct a Wasm binary by hand.
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
export const SECTION = {
  TYPE: 1,
  IMPORT: 2,
  FUNC: 3,
  MEMORY: 5,
  GLOBAL: 6,
  EXPORT: 7,
  CODE: 10,
};

export const EXPORT_TYPE = {
  FUNC: 0x00,
  TABLE: 0x01,
  MEMORY: 0x02,
  GLOBAL: 0x03,
} as const;

type Align = 1 | 2 | 3;

export const op = {
  /*
   * Control Instructions
   * https://webassembly.github.io/spec/core/binary/instructions.html#control-instructions
   */
  // unreachable: 0x00,
  // nop: 0x01,
  block: (blockType: BlockType) => [0x02, blockType],
  loop: (blockType: BlockType) => [0x03, blockType],
  if: (retType: BlockType) => [0x04, retType],
  else: 0x05,
  end: 0x0b,
  // br: (i: number) => [0x0c, ...signedLEB128(i)],
  br_if: (i: number) => [0x0d, ...unsignedLEB128(i)],
  // br_table: 0x0d,
  // return: 0x0f,
  call: (i: number) => [0x10, ...unsignedLEB128(i)],
  // call_indirect: 0x11,

  /*
   * Parametric Instructions
   * https://webassembly.github.io/spec/core/binary/instructions.html#parametric-instructions
   */
  drop: 0x1a,
  select: 0x1b,

  /*
   * Variable Instructions
   * https://webassembly.github.io/spec/core/binary/instructions.html#variable-instructions
   */
  local_get: (i: number) => [0x20, ...unsignedLEB128(i)],
  local_set: (i: number) => [0x21, ...unsignedLEB128(i)],
  local_tee: (i: number) => [0x22, ...unsignedLEB128(i)],
  global_get: (i: number) => [0x23, ...unsignedLEB128(i)],
  global_set: (i: number) => [0x24, ...unsignedLEB128(i)],

  /*
   * Memory Instructions
   * https://webassembly.github.io/spec/core/binary/instructions.html#memory-instructions
   */
  f64_load: (align: Align, offset: number) => [
    0x2b,
    ...unsignedLEB128(align),
    ...unsignedLEB128(offset),
  ],
  f64_store: (align: Align, offset: number) => [
    0x39,
    ...unsignedLEB128(align),
    ...unsignedLEB128(offset),
  ],

  /*
   * Numeric Instructions
   * https://webassembly.github.io/spec/core/binary/instructions.html#numeric-instructions
   */
  i32_const: (i: number) => [0x41, ...signedLEB128(i)],
  // i64_const: 0x42,
  // f32_const: 0x43,
  f64_const: (i: number) => [0x44, ...encodef64(i)],

  i32_eqz: 0x45,
  // i32_eq: 0x46,
  i32_ne: 0x47,
  i32_lt_s: 0x48,
  i32_lt_u: 0x49,
  i32_gt_s: 0x4a,
  // i32_gt_u: 0x4b,
  i32_le_s: 0x4c,
  i32_le_u: 0x4d,
  i32_ge_s: 0x4e,
  // i32_ge_u: 0x4f,

  // [0x50...0x5a] i64
  // [0x5b...0x60] f32

  f64_eq: 0x61,
  f64_ne: 0x62,
  f64_lt: 0x63,
  f64_gt: 0x64,
  f64_le: 0x65,
  f64_ge: 0x66,

  // i32_clz: 0x67,
  // i32_ctz: 0x68,
  // i32_popcnt: 0x69,
  i32_add: 0x6a,
  i32_sub: 0x6b,
  i32_mul: 0x6c,
  // i32_div_s: 0x6d,
  // i32_div_u: 0x6e,
  i32_rem_s: 0x6f,
  // i32_rem_u: 0x70,
  i32_and: 0x71,
  i32_or: 0x72,
  // [0x73...0x78] More i32

  // [0x79...0x8a] More i64
  i64_rem_s: 0x81,
  i64_and: 0x83,
  i64_or: 0x84,

  // [0x8b...0x98] More f32

  f64_abs: 0x99,
  f64_neg: 0x9a,
  f64_ceil: 0x9b,
  f64_floor: 0x9c,
  // f64_trunc: 0x9d,
  // f64_nearest: 0x9e,
  f64_sqrt: 0x9f,
  f64_add: 0xa0,
  f64_sub: 0xa1,
  f64_mul: 0xa2,
  f64_div: 0xa3,
  f64_min: 0xa4,
  f64_max: 0xa5,
  // f64_copysign: 0xa6,

  i32_trunc_f64_s: 0xaa,
  i32_trunc_f64_u: 0xab,
  i64_trunc_s_f64: 0xb0,
  f64_convert_i64_s: 0xb9,
  f64_convert_i32_s: 0xb7,
};

// https://webassembly.github.io/spec/core/binary/instructions.html#binary-blocktype
export const VAL_TYPE = {
  i32: 0x7f,
  i64: 0x7e,
  f32: 0x7d,
  f64: 0x7c,
} as const;

export const MUTABILITY = {
  const: 0x00,
  var: 0x01,
};

export const BLOCK = {
  void: 0x40,
  i32: 0x7f,
  i64: 0x7e,
  f32: 0x7d,
  f64: 0x7c,
} as const;
type BlockKeys = keyof typeof BLOCK;
export type BlockType = typeof BLOCK[BlockKeys];

// http://webassembly.github.io/spec/core/binary/types.html#function-types
export const FUNCTION_TYPE = 0x60;
// I think these might actually be specific to importdesc
export const MEMORY_IDX = 0x02;
export const GLOBAL_TYPE = 0x03;
export const TYPE_IDX = 0x00;

// Takes an f64 on the stack and leaves an int32 boolean representing if it's
// within epsilon of zero.
export const IS_ZEROISH: number[] = [
  op.f64_abs,
  ...op.f64_const(EPSILON),
  op.f64_lt,
];
export const IS_NOT_ZEROISH: number[] = [
  op.f64_abs,
  ...op.f64_const(EPSILON),
  op.f64_gt,
];

// f64
export function encodef64(num: number): Uint8Array {
  const arr = new Uint8Array(8);
  ieee754.write(arr, num);
  return arr;
}

export const encodeString = (str: string): number[] =>
  [str.length].concat(str.split("").map(s => s.charCodeAt(0)));

export function unsignedLEB128(n: number): number[] {
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

// https://github.com/shmishtopher/wasm-LEB128/blob/2f1039636e758293e571f996e8012c4d69f4b58f/lib/index.js#L6
export function signedLEB128(value: number): number[] {
  let bytes = [];
  let byte = 0x00;
  let size = Math.ceil(Math.log2(Math.abs(value)));
  let negative = value < 0;
  let more = true;

  while (more) {
    byte = value & 127;
    value = value >> 7;

    if (negative) {
      value = value | -(1 << (size - 7));
    }

    if (
      (value == 0 && (byte & 0x40) == 0) ||
      (value == -1 && (byte & 0x40) == 0x40)
    ) {
      more = false;
    } else {
      byte = byte | 128;
    }

    bytes.push(byte);
  }

  return bytes;
}

// https://webassembly.github.io/spec/core/binary/conventions.html#binary-vec
// Vectors are encoded with their length followed by their element sequence
export const encodeFlatVector = (data: number[]): number[] =>
  unsignedLEB128(data.length).concat(data);

export const encodeNestedVector = (data: number[][]): number[] =>
  unsignedLEB128(data.length).concat(flatten(data));

// subSections is an array of arrays
export function encodeSection(type: number, subSections: number[][]) {
  // Sections are all optional, so if we get an empty vector of subSections, we
  // can omit the whole section.
  if (subSections.length === 0) {
    return [];
  }

  // The size of this vector is not needed for decoding, but can be
  // used to skip sections when navigating through a binary.
  // TODO: Remove this assertion once we are more confident in our output.
  const vec = encodeFlatVector(encodeNestedVector(subSections));
  vec.unshift(type);
  return vec;
}
