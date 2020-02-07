const { encodef64, unsignedLEB128, ops, VAL_TYPE } = require("./encoding");

const localFuncMap = {
  sqr: {
    args: [VAL_TYPE.f64],
    returns: [VAL_TYPE.f64],
    locals: [],
    binary: [
      ops.local_get,
      ...unsignedLEB128(0),
      ops.local_get,
      ...unsignedLEB128(0),
      ops.f64_mul,
    ],
  },
};

module.exports = { localFuncMap };
