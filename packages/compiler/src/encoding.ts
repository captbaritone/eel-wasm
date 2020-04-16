import * as ieee754 from "./ieee754";

const EPSILON = 0.00001;

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
};

export const op = {
  block: 0x02,
  loop: 0x03,
  br: 0x0c,
  br_if: 0x0d,
  select: 0x1b,
  call: 0x10,
  drop: 0x1a,
  f64_load: 0x2b,
  f64_store: 0x39,
  i32_and: 0x71,
  i32_or: 0x72,
  i32_const: 0x41,
  i32_ne: 0x47,
  i32_add: 0x6a,
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

export const VAL_TYPE = {
  i32: 0x7f,
  i64: 0x7e,
  f32: 0x7d,
  f64: 0x7c,
};

export const MUTABILITY = {
  const: 0x00,
  var: 0x01,
};

export const BLOCK = {
  void: 0x40,
};

export function assertNumbers(nums: number[]): number[] {
  nums.forEach((num, i) => {
    if (typeof num != "number") {
      throw new Error(
        `Found non-numeric value in program binary at index ${i}. Got ${typeof num}`
      );
    }
  });
  return nums;
}

// http://webassembly.github.io/spec/core/binary/types.html#function-types
export const FUNCTION_TYPE = 0x60;
// I think these might actually be specific to importdesc
export const GLOBAL_TYPE = 0x03;
export const TYPE_IDX = 0x00;

// Takes an f64 on the stack and leaves an int32 boolean representing if it's
// within epsilon of zero.
export const IS_ZEROISH = [
  op.f64_abs,
  op.f64_const,
  ...encodef64(EPSILON),
  op.f64_lt,
];
export const IS_NOT_ZEROISH = [
  op.f64_abs,
  op.f64_const,
  ...encodef64(EPSILON),
  op.f64_gt,
];

// f64
export function encodef64(num: number): Uint8Array {
  const arr = new Uint8Array(8);
  ieee754.write(arr, num);
  return arr;
}

export const encodeString = (str: string): number[] => [
  str.length,
  ...str.split("").map(s => s.charCodeAt(0)),
];

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

const flatten = (arr: Array<number[] | number>): number[] =>
  [].concat.apply([], arr);

// https://webassembly.github.io/spec/core/binary/conventions.html#binary-vec
// Vectors are encoded with their length followed by their element sequence
export const encodeVector = (data: Array<number[] | number>): number[] => [
  ...unsignedLEB128(data.length),
  ...flatten(data),
];

// subSections is an array of arrays
export function encodeSection(type: number, subSections: Array<number[]>) {
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