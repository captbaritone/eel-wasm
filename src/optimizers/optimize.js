const foldConstants = require("./constantFolding");
const propagateConstants = require("./constantPropagation");
// const hoistConstants = require("./constantHoisting");

function runPass(ast) {
  return propagateConstants(foldConstants(ast));
}

function optimize(ast) {
  let newAst = runPass(ast);
  while (ast !== newAst) {
    ast = newAst;
    newAst = runPass(newAst);
  }
  // newAst = hoistConstants(newAst);
  return newAst;
}

module.exports = optimize;
