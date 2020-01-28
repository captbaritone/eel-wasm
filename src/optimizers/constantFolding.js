const { mapAst } = require("./astUtils");

function isLiteral(ast) {
  return ast.type === "NUMBER_LITERAL";
}

const BINARY_EXPRESSIONS = {
  "+": (left, right) => left + right,
  "-": (left, right) => left - right,
  "*": (left, right) => left * right,
  "/": (left, right) => left / right,
};

function foldConstants(rootNode) {
  return mapAst(rootNode, ast => {
    switch (ast.type) {
      case "UNARY_EXPRESSION":
        const value = ast.value;
        if (isLiteral(value)) {
          switch (ast.operator) {
            case "-":
              return { type: "NUMBER_LITERAL", value: -value.value };
            case "+":
              return value;
          }
        }
        return ast;
      case "BINARY_EXPRESSION":
        const { left, right } = ast;
        const func = BINARY_EXPRESSIONS[ast.operator];
        if (isLiteral(left) && isLiteral(right) && func != null) {
          return {
            type: "NUMBER_LITERAL",
            value: func(left.value, right.value)
          };
        }
        return ast;
      case "CONDITIONAL_EXPRESSION":
        const { test, consiquent, alternate } = ast;
        if (isLiteral(test)) {
          return test.value ? consiquent : alternate;
        }
        return ast;
    }
    return ast;
  });
}

module.exports = foldConstants;
