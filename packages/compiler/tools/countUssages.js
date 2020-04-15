const { mapAst } = require("../src/astUtils");

function countUssages(root, context) {
  mapAst(root, ast => {
    context.nodeTypes.add(ast.type);
    switch (ast.type) {
      case "CALL_EXPRESSION":
        context.functions.add(ast.callee.value);
        break;
      case "LOGICAL_EXPRESSION":
        context.logicalOperators.add(ast.operator);
        break;
      case "BINARY_EXPRESSION":
        context.binaryOperators.add(ast.operator);
        break;
      case "UNARY_EXPRESSION":
        context.unaryOperators.add(ast.operator);
        break;
      case "ASSIGNMENT_EXPRESSION":
        context.assignmentOperators.add(ast.operator);
    }
  });
}

module.exports = countUssages;
