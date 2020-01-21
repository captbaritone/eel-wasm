const shims = require("./shims");

const BINARY_OPERATORS = {
  "+": "f64.add",
  "-": "f64.sub",
  "*": "f64.mul",
  "/": "f64.div"
};

const FUNCTIONS = {
  abs: { arity: 1, instruction: "f64.abs" },
  sqrt: { arity: 1, instruction: "f64.sqrt" },
  // TODO: What's the difference between trunc and floor?
  // TODO: Is a rounded float the right thing here, or do we want an int?
  int: { arity: 1, instruction: "f64.floor" },
  min: { arity: 2, instruction: "f64.min" },
  max: { arity: 2, instruction: "f64.max" },
  // We use `lt` here rather than `gt` because the stack is backwards.
  above: { arity: 2, instruction: "f64.lt f64.convert_i32_s" },
  // We use `gt` here rather than `lt` because the stack is backwards.
  below: { arity: 2, instruction: "f64.gt f64.convert_i32_s" },
  equal: { arity: 2, instruction: "f64.eq f64.convert_i32_s" }
};

Object.entries(shims).forEach(([key, value]) => {
  FUNCTIONS[key] = { arity: value.length, instruction: `call $${key}` };
});

function emit(ast, context) {
  switch (ast.type) {
    case "MODULE": {
      const globals = Array.from(context.globals).map(name => {
        return `(global $${name} (import "js" "${name}") (mut f64))`;
      });
      const exportedFunctions = ast.exportedFunctions.map(func => {
        return `${emit(func, context)}`;
      });

      const imports = Object.entries(shims).map(([key, value]) => {
        const arity = value.length;
        const params = new Array(arity).fill("(param f64)").join(" ");
        return `(func $${key} (import "imports" "${key}") ${params} (result f64))`;
      });

      return `(module
        ${globals.join("\n")}
        ${imports.join("\n")}
        ${exportedFunctions.join("\n")}
      )`;
    }
    case "FUNCTION_EXPORT": {
      // Set the local scope.
      context.locals = new Set();
      const body = emit(ast.function, context);

      const locals = Array.from(context.locals).map(name => {
        return `(local $${name} f64)`;
      });
      // Reset the local scope. (Not strictly nessesary, but nice to clean up)
      context.locals = new Set();
      return `(func $${ast.name} ${locals.join(" ")} ${body} drop)
        (export "${ast.name}" (func $${ast.name}))`;
    }
    case "SCRIPT": {
      return emit(ast.body, context);
    }
    case "STATEMENT": {
      return `${emit(ast.expression, context)}`;
    }
    case "STATEMENT_BLOCK": {
      const body = ast.body.map((statement, i) => {
        const last = i === ast.body.length - 1;
        return `${emit(statement, context)} ${last ? "" : "drop"}`;
      });
      return `${body.join("\n")}`;
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
        throw new Error(
          `Unknown call callee \`${JSON.stringify(ast.callee)}\``
        );
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
        // TODO: Find a way to manage mapping global variables that need a $
        // prefix to EEL variables that cannot use $.

        // TODO: In lots of cases we don't care about the return value. In those
        // cases we should try to find a way to omit the `get/drop` combo.
        // Peephole optimization seems to be the conventional way to do this.
        // https://en.wikipedia.org/wiki/Peephole_optimization
        return `
            ${emit(ast.right, context)}
            global.set $${variableName}
            global.get $${variableName}
        `;
      }

      // Ensure we have registed this as a local variable.
      if (!context.locals.has(variableName)) {
        context.locals.add(variableName);
      }

      return `
          ${emit(ast.right, context)}
          tee_local $${ast.left.value}
      `;
    }
    // TODO: This is less of an "if statement" and more of an "if call".
    case "IF_STATEMENT": {
      // TODO: It's unclear if `if()` actually shortcircuts. If it does, we could
      // TODO: Could this just be implemented as a function call?
      return `
        ${emit(ast.consiquent, context)}
        ${emit(ast.alternate, context)}
        ${emit(ast.test, context)}
        f64.const 0 f64.ne
        select
      `;
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
      const value = emit(ast.value, context);
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
      const variableName = ast.value;
      if (context.globals.has(variableName)) {
        // TODO: It's a bit odd that not every IDENTIFIER node gets emitted. In
        // function calls and assignments we just peek at the name and never emit
        // it.
        return `global.get $${variableName}`;
      }
      if (context.locals.has(variableName)) {
        return `local.get $${variableName}`;
      }
      throw new Error(`Unknown variable "${variableName}"`);
    case "NUMBER_LITERAL":
      return `f64.const ${ast.value}`;
    default:
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { emit };
