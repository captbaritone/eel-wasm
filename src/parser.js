const { preProcess } = require("./preProcessor");
let parserImpl = null;
// Always use the dynamic one, while we figure out why the built one doens't work.
if (process.env.NODE_ENV === "production") {
  parserImpl = require("../build/parser");
} else {
  parserImpl = require("../tools/buildParser");
}

function parse(code) {
  const processedCode = preProcess(code);
  return parserImpl.parse(processedCode);
}

module.exports = { parse };
