function compile(ast) {
  switch (ast.type) {
    case "BINARY_EXPRESSION": {
      const left = compile(ast.left);
      const right = compile(ast.right);
      switch (ast.operator) {
        case "+":
          return `(f32.add ${left} ${right})`;
        case "-":
          return `(f32.sub ${left} ${right})`;
        default:
            throw new Error(`Unknown binary operator ${ast.operator}`)
      }
    }
    case "UNARY_EXPRESSION": {
      const value = compile(ast.value);
      switch (ast.operator) {
        case "-":
          return `(f32.sub (f32.const 0) ${value} )`;
        case "+":
          return value;
        default:
            throw new Error(`Unknown unary operator ${ast.operator}`)
      }
    }
    case "NUMBER_LITERAL":
      return `(f32.const ${ast.value})`
    default:
      console.error(ast)
        throw new Error(`Unknown AST node type ${ast.type}`)
  }
}

module.exports = {compile}