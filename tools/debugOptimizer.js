// Looks at a script and outputs a visual diff of it vs it's optimized form.

const printDiff = require("print-diff");
const fs = require("fs");
const path = require("path");
const { parse } = require("../parser");
const { print } = require("./prettyPrinter");
const optimize = require("../optimizers/optimize");

function main() {
  const filePath = process.argv[2];

  if (filePath == null) {
    console.error("Please pass a .eel file as the first argument.");
    return;
  }
  const eel = fs.readFileSync(path.join(process.cwd(), filePath), {
    encoding: "utf8"
  });

  const ast = parse(eel);

  const optimizedAst = optimize(ast);

  const prettyEel = print(ast);
  const prettyOptimizedEel = print(optimizedAst);

  printDiff.inline(prettyEel, prettyOptimizedEel);
}

main();
