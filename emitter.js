const BINARY_OPERATORS = {
  "+": "f64.add",
  "-": "f64.sub",
  "*": "f64.mul",
  "/": "f64.div"
};

const FUNCTIONS = {
  abs: { arity: 1, instruction: "f64.abs" },
  sqrt: { arity: 1, instruction: "f64.sqrt" },
  sin: { arity: 1, instruction: "call $sin" },
  // TODO: What's the difference between trunc and floor?
  // TODO: Is a rounded float the right thing here, or do we want an int?
  int: { arity: 1, instruction: "f64.floor" },
  min: { arity: 2, instruction: "f64.min" },
  max: { arity: 2, instruction: "f64.max" },
};

function emit(ast) {
  switch (ast.type) {
    case "BINARY_EXPRESSION": {
      const left = emit(ast.left);
      const right = emit(ast.right);
      const instruction = BINARY_OPERATORS[ast.operator];
      if (instruction == null) {
        throw new Error(`Unknown binary operator ${ast.operator}`);
      }
      return `${left} ${right} ${instruction}`;
    }
    case "CALL_EXPRESSION": {
      const func = FUNCTIONS[ast.callee.value];
      if (func == null) {
        throw new Error(`Unknown call callee ${ast.callee}`);
      }
      const { instruction, arity } = func;
      if (ast.arguments.length !== arity) {
        throw new Error(
          `Incorrect number of arguments passed to ${ast.callee.value}. Got ${ast.arguments.length}, expected ${arity}`
        );
      }
      const args = ast.arguments.map(emit);
      return `${args.join(" ")} ${instruction}`;
    }
    case "UNARY_EXPRESSION": {
      const value = emit(ast.value);
      switch (ast.operator) {
        case "-":
          return `${value} f64.neg`;
        case "+":
          return value;
        default:
          throw new Error(`Unknown unary operator ${ast.operator}`);
      }
    }
    case "NUMBER_LITERAL":
      return `f64.const ${ast.value}`;
    default:
      console.error(ast);
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { emit };
