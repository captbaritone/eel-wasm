import {
  encodef64,
  unsignedLEB128,
  op,
  VAL_TYPE,
  IS_NOT_ZEROISH,
  EPSILON,
  signedLEB128,
} from "./encoding";
import { FunctionDefinition } from "./types";

export const localFuncMap: { [functionName: string]: FunctionDefinition } = {
  sqr: {
    args: [VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      op.local_get,
      ...unsignedLEB128(0),
      op.local_get,
      ...unsignedLEB128(0),
      op.f64_mul,
    ],
  },
  bor: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      op.local_get,
      ...unsignedLEB128(0),
      ...IS_NOT_ZEROISH,
      op.local_get,
      ...unsignedLEB128(1),
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
      op.local_get,
      ...unsignedLEB128(0),
      ...IS_NOT_ZEROISH,
      op.local_get,
      ...unsignedLEB128(1),
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
      op.local_get,
      ...unsignedLEB128(0),
      op.f64_lt,
      op.local_get,
      ...unsignedLEB128(0),
      ...op.f64_const(0),
      op.f64_lt,
      op.i32_sub,
      op.f64_convert_i32_s,
    ],
  },
  mod: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    // TODO: Simplify all this type coersion
    binary: [
      op.local_get,
      ...unsignedLEB128(0),
      op.i64_trunc_s_f64,
      op.local_get,
      ...unsignedLEB128(1),
      op.i64_trunc_s_f64,
      op.i64_rem_s,
      op.f64_convert_s_i64,
    ],
  },
  bitwiseOr: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      op.local_get,
      ...unsignedLEB128(0),
      op.i64_trunc_s_f64,
      op.local_get,
      ...unsignedLEB128(1),
      op.i64_trunc_s_f64,
      op.i64_or,
      op.f64_convert_s_i64,
    ],
  },
  bitwiseAnd: {
    args: [VAL_TYPE.f64, VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    binary: [
      op.local_get,
      ...unsignedLEB128(0),
      op.i64_trunc_s_f64,
      op.local_get,
      ...unsignedLEB128(1),
      op.i64_trunc_s_f64,
      op.i64_and,
      op.f64_convert_s_i64,
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
    returns: [VAL_TYPE.i32 /* $noramlizedIndex */],
    localVariables: [
      VAL_TYPE.f64, // 1: $with_near
      VAL_TYPE.i32, // 2: $truncated
    ],
    binary: [
      ...op.f64_const(EPSILON),
      op.local_get,
      ...unsignedLEB128(0), // $index
      op.f64_add,
      // STACK: [$i + EPSILON]
      op.local_tee,
      ...unsignedLEB128(1), // $with_near

      op.i32_trunc_s_f64,
      // TODO We could probably make this a tee and get rid of the next get if we swap the final condition
      op.local_set,
      ...unsignedLEB128(2), // $truncated
      // STACK: []
      ...op.i32_const(-1),
      op.local_get,
      ...unsignedLEB128(2), // $truncated
      // STACK: [-1, $truncated]
      op.local_get,
      ...unsignedLEB128(2), // $truncated
      ...op.i32_const(0),
      // STACK: [-1, $truncated, $truncated, 0]
      op.i32_lt_s,
      // STACK: [-1, $truncated, <is index less than 0>]
      op.local_get,
      ...unsignedLEB128(2), // $truncated
      ...op.i32_const(8388608),
      op.i32_gt_s,
      // STACK: [-1, $truncated, <is index less than 0>, <is index more than MAX>]
      op.i32_or,
      // STACK: [-1, $truncated, <is index out of range>]
      op.select,
    ],
  },
};
