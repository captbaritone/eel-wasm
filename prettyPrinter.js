function print(ast) {
  switch (ast.type) {
    case "MODULE": {
      throw new Error("MODULE cannot be pretty printed");
    }
    case "FUNCTION_EXPORT": {
      throw new Error("FUNCTION_EXPORT cannot be pretty printed");
    }
    case "SCRIPT": {
      return ast.body.map(expression => print(expression)).join(" ");
    }
    case "EXPRESSION_BLOCK": {
      return ast.body.map(expression => print(expression)).join(" ");
    }
    case "BINARY_EXPRESSION": {
      return `${print(ast.left)} ${ast.operator} ${print(ast.right)}`;
    }
    case "CALL_EXPRESSION": {
      const args = ast.arguments
        .map(expression => print(expression))
        .join(", ");
      return `${print(ast.callee)}(${args})`;
    }
    case "ASSIGNMENT_EXPRESSION": {
      return `${print(ast.left)} ${ast.operator} ${print(ast.right)};`;
    }
    case "CONDITIONAL_EXPRESSION": {
      return `${print(ast.test)} ? ${print(ast.consiquent)} : ${print(
        ast.alternate
      )}`;
    }
    case "UNARY_EXPRESSION": {
      return `${ast.operator}${print(ast.value)}`;
    }
    case "IDENTIFIER":
      return ast.value;
    case "NUMBER_LITERAL":
      return ast.value;
    default:
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { print };
