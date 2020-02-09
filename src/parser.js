let parser = null;
if (process.env.NODE_ENV === "production") {
  parser = require("../build/parser");
} else {
  parser = require("../tools/buildParser");
}

module.exports = parser;
