module.exports = {
  // TODO: Reimplement these functions natively in Wasm
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
};
