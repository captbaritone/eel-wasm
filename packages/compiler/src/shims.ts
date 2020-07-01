import { Shims } from "./types";

const EPSILON = 0.00001;

const shims: Shims = {
  // TODO: Reimplement some of these functions natively in Wasm?
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  rand: a => Math.floor(Math.random() * a),
  pow: Math.pow,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  sigmoid: function(x: number, y: number): number {
    const t = 1 + Math.exp(-x * y);
    return Math.abs(t) > EPSILON ? 1.0 / t : 0;
  },
};

export default shims;
