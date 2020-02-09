let parser = null;
// Always use the dynamic one, while we figure out why the built one doens't work.
if (process.env.NODE_ENV === "production") {
  parser = require("../build/parser");
} else {
  parser = require("../tools/buildParser");
}

module.exports = parser;
