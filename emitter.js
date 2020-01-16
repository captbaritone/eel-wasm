function emit(ast) {
  switch (ast.type) {
    case "BINARY_EXPRESSION": {
      const left = emit(ast.left);
      const right = emit(ast.right);
      switch (ast.operator) {
        case "+":
          return `(f32.add ${left} ${right})`;
        case "-":
          return `(f32.sub ${left} ${right})`;
        case "*":
          return `(f32.mul ${left} ${right})`;
        case "/":
          return `(f32.div ${left} ${right})`;
        default:
            throw new Error(`Unknown binary operator ${ast.operator}`)
      }
    }
    case "CALL_EXPRESSION": {
      switch(ast.callee.value) {
        case "abs":
          // TODO assert arity
          const arg = emit(ast.arguments[0]);
          return `(f32.abs ${arg})`
        default:
        throw new Error(`Unknown call callee ${ast.callee}`)
      }
    }
    case "UNARY_EXPRESSION": {
      const value = emit(ast.value);
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

module.exports = {emit}