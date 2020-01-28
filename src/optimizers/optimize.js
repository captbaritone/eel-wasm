const foldConstants = require("./constantFolding");
const propagateConstants = require("./constantPropagation");

function runPass(ast) {
  return propagateConstants(foldConstants(ast));
}

function optimize(ast) {
  let newAst = runPass(ast);
  while (ast !== newAst) {
    ast = newAst;
    newAst = runPass(newAst);
  }
  return newAst;
}

module.exports = optimize;