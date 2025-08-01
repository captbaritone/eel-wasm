import { op, VAL_TYPE, IS_NOT_ZEROISH, EPSILON, BLOCK } from "./encoding.js";
import { FunctionDefinition } from "./types.js";
import { BUFFER_SIZE } from "./constants.js";

export const localFuncMap: { [functionName: string]: FunctionDefinition } = {
  sqr: {
    args: [VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [...op.local_get(0), ...op.local_get(0), op.f64_mul],
  },
  bor: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      ...op.local_get(0),
      ...IS_NOT_ZEROISH,
      ...op.local_get(1),
      ...IS_NOT_ZEROISH,
      op.i32_or,
      ...op.i32_const(0),
      op.i32_ne,
      op.f64_convert_i32_s,
    ],
  },
  band: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      ...op.local_get(0),
      ...IS_NOT_ZEROISH,
      ...op.local_get(1),
      ...IS_NOT_ZEROISH,
      op.i32_and,
      ...op.i32_const(0),
      op.i32_ne,
      op.f64_convert_i32_s,
    ],
  },
  sign: {
    args: [VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      ...op.f64_const(0),
      ...op.local_get(0),
      op.f64_lt,
      ...op.local_get(0),
      ...op.f64_const(0),
      op.f64_lt,
      op.i32_sub,
      op.f64_convert_i32_s,
    ],
  },
  mod: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    localVariables: [VAL_TYPE.i32],
    // TODO: Simplify all this type coercion
    binary: [
      ...op.local_get(1),
      op.i32_trunc_f64_s,
      ...op.local_tee(2),
      ...op.i32_const(0),
      op.i32_ne,
      ...op.if(BLOCK.f64),
      ...op.local_get(0),
      op.i32_trunc_f64_s,
      ...op.local_get(2),
      op.i32_rem_s,
      op.f64_convert_i32_s,
      op.else,
      ...op.f64_const(0),
      op.end,
    ],
  },
  bitwiseOr: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      ...op.local_get(0),
      op.i64_trunc_s_f64,
      ...op.local_get(1),
      op.i64_trunc_s_f64,
      op.i64_or,
      op.f64_convert_i64_s,
    ],
  },
  bitwiseAnd: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      ...op.local_get(0),
      op.i64_trunc_s_f64,
      ...op.local_get(1),
      op.i64_trunc_s_f64,
      op.i64_and,
      op.f64_convert_i64_s,
    ],
  },
  div: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    localVariables: [VAL_TYPE.i32],
    binary: [
      ...op.local_get(1),
      ...op.f64_const(0),
      op.f64_ne,
      ...op.if(BLOCK.f64),
      ...op.local_get(0),
      ...op.local_get(1),
      op.f64_div,
      op.else,
      ...op.f64_const(0),
      op.end,
    ],
  },
  // Takes a float buffer index and converts it to an int. Values out of range
  // are returned as `-1`.
  //
  // NOTE: There's actually a subtle bug that exists in Milkdrop's Eel
  // implementation, which we reproduce here.
  //
  // Wasm's `trunc()` rounds towards zero. This means that for index `-1` we
  // will return zero, since: `roundTowardZero(-1 + EPSILON) == 0`
  //
  // A subsequent check handles negative indexes, so negative indexes > than
  // `-1` are not affected.
  _getBufferIndex: {
    args: [VAL_TYPE.f64 /* 0: $index */],
    returns: [VAL_TYPE.i32 /* $normalizedIndex */],
    localVariables: [
      VAL_TYPE.f64, // 1: $with_near
      VAL_TYPE.i32, // 2: $truncated
    ],
    binary: [
      ...op.f64_const(EPSILON),
      ...op.local_get(0),
      op.f64_add,
      // STACK: [$i + EPSILON]
      ...op.local_tee(1), // $with_near

      op.i32_trunc_f64_s,
      // TODO We could probably make this a tee and get rid of the next get if we swap the final condition
      ...op.local_set(2),
      // STACK: []
      ...op.i32_const(-1),
      ...op.local_get(2),
      // STACK: [-1, $truncated]
      ...op.i32_const(8),
      op.i32_mul,
      // STACK: [-1, $truncated * 8]
      ...op.local_get(2), // $truncated
      ...op.i32_const(0),
      // STACK: [-1, $truncated * 8, $truncated, 0]
      op.i32_lt_s,
      // STACK: [-1, $truncated * 8, <is index less than 0>]
      ...op.local_get(2), // $truncated
      ...op.i32_const(BUFFER_SIZE - 1),
      op.i32_gt_s,
      // STACK: [-1, $truncated * 8, <is index less than 0>, <is index more than MAX>]
      op.i32_or,
      // STACK: [-1, $truncated * 8, <is index out of range>]
      op.select,
    ],
  },
};
