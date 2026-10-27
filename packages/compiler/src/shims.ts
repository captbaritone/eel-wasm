import { Shims } from "./types.js";

const EPSILON = 0.00001;

const shims: Shims = {
  // TODO: Re-implement some of these functions natively in Wasm?
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  rand: a => Math.random() * a,
  randint: (a: number) => Math.floor(Math.random() * a),
  pow: Math.pow,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  sigmoid: function(x: number, y: number): number {
    const t = 1 + Math.exp(-x * y);
    return Math.abs(t) > EPSILON ? 1.0 / t : 0;
  },
  // Float remainder: unlike the % operator, the operands are not truncated.
  // Zero divisors yield 0, matching the `mod` guard.
  fmod: (a: number, b: number) => (b === 0 ? 0 : a % b),
  invsqrt: (a: number) => (a <= 0 ? 0 : 1 / Math.sqrt(a)),
  smoothstep: function(e0: number, e1: number, v: number): number {
    if (e0 === e1) {
      return v < e0 ? 0 : 1;
    }
    const t = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
  },
};

export default shims;
