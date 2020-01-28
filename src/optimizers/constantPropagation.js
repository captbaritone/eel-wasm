const { mapAst } = require("./astUtils");

function propagateConstants(rootNode) {
  const constantVariables = {};
  return mapAst(rootNode, ast => {
    switch (ast.type) {
      case "ASSIGNMENT_EXPRESSION":
        if (ast.operator === "=" && ast.right.type === "NUMBER_LITERAL") {
          constantVariables[ast.left.value] = ast.right;
        } else {
          constantVariables[ast.left.value] = null;
        }
        break;
      case "IDENTIFIER":
        const variableName = ast.value;
        const constant = constantVariables[variableName];
        if (constant != null) {
          return { type: "NUMBER_LITERAL", value: constant.value };
        }
        break;
    }
    return ast;
  });
}

module.exports = propagateConstants;
