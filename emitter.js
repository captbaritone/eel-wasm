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
  cos: { arity: 1, instruction: "call $cos" },
  tan: { arity: 1, instruction: "call $tan" },
  asin: { arity: 1, instruction: "call $asin" },
  acos: { arity: 1, instruction: "call $acos" },
  atan: { arity: 1, instruction: "call $atan" },
  atan2: { arity: 2, instruction: "call $atan2" },
  // TODO: What's the difference between trunc and floor?
  // TODO: Is a rounded float the right thing here, or do we want an int?
  int: { arity: 1, instruction: "f64.floor" },
  min: { arity: 2, instruction: "f64.min" },
  max: { arity: 2, instruction: "f64.max" }
};

function emit(ast, context) {
  switch (ast.type) {
    case "PROGRAM": {
      const globals = Array.from(context.globals).map(name => {
        return `(global $${name} (import "js" "${name}") (mut f64))`;
      });
      const body = ast.body.map(statement => emit(statement, context));
      return `(module
        ${globals.join("\n")}
        (func $sin (import "imports" "sin") (param f64) (result f64))
        (func $cos (import "imports" "cos") (param f64) (result f64))
        (func $tan (import "imports" "tan") (param f64) (result f64))
        (func $asin (import "imports" "asin") (param f64) (result f64))
        (func $acos (import "imports" "acos") (param f64) (result f64))
        (func $atan (import "imports" "atan") (param f64) (result f64))
        (func $atan2 (import "imports" "atan2") (param f64) (param f64) (result f64))
        (func $run ${body.join("\n")})
        (export "run" (func $run))
      )`;
    }
    case "STATEMENT": {
      return `${emit(ast.expression, context)} drop`;
    }
    case "BINARY_EXPRESSION": {
      const left = emit(ast.left, context);
      const right = emit(ast.right, context);
      const instruction = BINARY_OPERATORS[ast.operator];
      if (instruction == null) {
        throw new Error(`Unknown binary operator ${ast.operator}`);
      }
      return `${left} ${right} ${instruction}`;
    }
    case "CALL_EXPRESSION": {
      const func = FUNCTIONS[ast.callee.value];
      if (func == null) {
        throw new Error(`Unknown call callee \`${JSON.stringify(ast.callee)}\``);
      }
      const { instruction, arity } = func;
      if (ast.arguments.length !== arity) {
        throw new Error(
          `Incorrect number of arguments passed to ${ast.callee.value}. Got ${ast.arguments.length}, expected ${arity}`
        );
      }
      const args = ast.arguments.map(node => emit(node, context));
      return `${args.join(" ")} ${instruction}`;
    }
    case "ASSIGNMENT_EXPRESSION": {
      const variableName = ast.left.value;
      if (context.globals.has(variableName)) {
        // TODO: Find a way to manage mapping global variables that need a $ prefix to EEL variables that cannot use $.
        return `
            ${emit(ast.right, context)} global.set $${ast.left.value}
            global.get $${ast.left.value}
          `;
      }

      throw new Error(
        `Local variables are not yet implemented, and '${variableName}' is not a global.`
      );
    }
    case "CONDITIONAL_EXPRESSION": {
      // TODO: In some cases https://webassembly.studio/ compiles these to use `select`.
      // Is that an optimization that we might want as well?
      return `
        ${emit(ast.test, context)}
        f64.const 0 f64.ne
        if (result f64)
          ${emit(ast.consiquent, context)}
        else
          ${emit(ast.alternate, context)}
        end
      `;
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
    case "IDENTIFIER":
      // TODO: It's a bit odd that not every IDENTIFIER node gets emitted. In
      // function calls and assignments we just peek at the name and never emit
      // it.
      return `global.get $${ast.value}`;
    case "NUMBER_LITERAL":
      return `f64.const ${ast.value}`;
    default:
      console.error(ast);
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { emit };
