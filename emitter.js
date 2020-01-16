const BINARY_OPERATORS = {
  "+": "f32.add",
  "-": "f32.sub",
  "*": "f32.mul",
  "/": "f32.div",
}

function emit(ast) {
  switch (ast.type) {
    case "BINARY_EXPRESSION": {
      const left = emit(ast.left);
      const right = emit(ast.right);
      const instruction = BINARY_OPERATORS[ast.operator]
      if(instruction == null) {
          throw new Error(`Unknown binary operator ${ast.operator}`);
      }
      return `${left} ${right} ${instruction}`;
    }
    case "CALL_EXPRESSION": {
      switch (ast.callee.value) {
        case "abs":
          // TODO assert arity
          const arg = emit(ast.arguments[0]);
          return `${arg} f32.abs`;
        case "min": {
          // TODO assert arity
          const first = emit(ast.arguments[0]);
          const second = emit(ast.arguments[1]);
          return `${first} ${second} f32.min`;
        }
        case "max": {
          // TODO assert arity
          const first = emit(ast.arguments[0]);
          const second = emit(ast.arguments[1]);
          return `${first} ${second} f32.max`;
        }
        default:
          throw new Error(`Unknown call callee ${ast.callee}`);
      }
    }
    case "UNARY_EXPRESSION": {
      const value = emit(ast.value);
      switch (ast.operator) {
        case "-":
          return `${value} f32.neg`;
        case "+":
          return value;
        default:
          throw new Error(`Unknown unary operator ${ast.operator}`);
      }
    }
    case "NUMBER_LITERAL":
      return `f32.const ${ast.value}`;
    default:
      console.error(ast);
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { emit };
