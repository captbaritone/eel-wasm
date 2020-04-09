// This module is in charge of selecting either the pre-built module or the one
// that builds it a runtime with jison.

let parserImpl = null;
// Always use the dynamic one, while we figure out why the built one doens't work.
if (process.env.NODE_ENV === "production") {
  parserImpl = require("../build/parser");
} else {
  parserImpl = require("../tools/buildParser");
}

module.exports = { parse: parserImpl.parse };
