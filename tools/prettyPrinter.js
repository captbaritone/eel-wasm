function print(ast) {
  switch (ast.type) {
    case "SCRIPT": {
      return ast.body.map(print).join("\n");
    }
    case "EXPRESSION_BLOCK": {
      const expressions = ast.body.map(print);
      return expressions.join("\n");
    }
    case "BINARY_EXPRESSION": {
      return `${print(ast.left)} ${ast.operator} ${print(ast.right)}`;
    }
    case "CALL_EXPRESSION": {
      const args = ast.arguments.map(print).join(", ");
      return `${print(ast.callee)}(${args})`;
    }
    case "ASSIGNMENT_EXPRESSION": {
      return `${print(ast.left)} ${ast.operator} ${print(ast.right)};`;
    }
    case "CONDITIONAL_EXPRESSION": {
      const test = print(ast.test);
      const consiquent = print(ast.consiquent);
      const alternate = print(ast.alternate);
      return `${test} ? ${consiquent} : ${alternate}`;
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
