const shims = require("./shims");

function makeNamespaceResolver(prefix) {
  let counter = -1;
  const map = new Map();
  return (name) => {

    if (!map.has(name)) {
      counter++;
      map.set(name, counter);
    }
    return `$${prefix}${map.get(name)}`;
  }
}

const STANDARD_LIBRARY = `
;; TODO: We should double check that this does not short circut
(func $if (param $test f64) (param $consiquent f64) (param $alternate f64) (result f64) 
  get_local $consiquent
  get_local $alternate
  get_local $test
  f64.const 0 f64.ne
  select 
)
;; TODO: Simplify all this type coersion
(func $bor (param $a f64) (param $b f64) (result f64) 
  get_local $a
  i32.trunc_s/f64
  get_local $b
  i32.trunc_s/f64
  i32.or
  i32.const 0
  i32.ne
  f64.convert_s/i32
)
(func $mod (param $a f64) (param $b f64) (result f64) 
  get_local $a
  i64.trunc_s/f64
  get_local $b
  i64.trunc_s/f64
  i64.rem_s
  f64.convert_s/i64
)
(func $bitwiseAnd (param $a f64) (param $b f64) (result f64) 
  get_local $a
  i64.trunc_s/f64
  get_local $b
  i64.trunc_s/f64
  i64.and
  f64.convert_s/i64
)
(func $bitwiseOr (param $a f64) (param $b f64) (result f64) 
  get_local $a
  i64.trunc_s/f64
  get_local $b
  i64.trunc_s/f64
  i64.or
  f64.convert_s/i64
)
(func $bnot (param $x f64) (result f64) 
  get_local $x
  i32.trunc_s/f64
  i32.eqz
  f64.convert_s/i32
)
`;

const BINARY_OPERATORS = {
  "+": "f64.add",
  "-": "f64.sub",
  "*": "f64.mul",
  "/": "f64.div",
  "%": "call $mod",
  "|": "call $bitwiseOr",
  "&": "call $bitwiseAnd"
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
  equal: { arity: 2, instruction: "f64.eq f64.convert_i32_s" },
  bnot: { arity: 1, instruction: "call $bnot" },
  bor: { arity: 2, instruction: "call $bor" },
  if: { arity: 3, instruction: "call $if" }
};

Object.entries(shims).forEach(([key, value]) => {
  FUNCTIONS[key] = { arity: value.length, instruction: `call $${key}` };
});

function emit(ast, context) {
  switch (ast.type) {
    case "MODULE": {
      context.resolveGlobal = makeNamespaceResolver("G")
      context.resolveImport = makeNamespaceResolver("F")

      const globals = Array.from(context.globals).map(name => {
        return `(global ${context.resolveGlobal(
          name
        )} (import "js" "${name}") (mut f64))`;
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
        ${STANDARD_LIBRARY}
        
        ${exportedFunctions.join("\n")}
      )`;
    }
    case "FUNCTION_EXPORT": {
      // Set the local scope.
      // context.localNames = new NamespaceMap({ prefix: "L" });
      context.resolveLocal = makeNamespaceResolver("L")
      context.locals = new Set();
      const body = emit(ast.function, context);

      const locals = Array.from(context.locals).map(name => {
        return `(local ${context.resolveLocal(name)} f64)`;
      });
      // Reset the local scope. (Not strictly nessesary, but nice to clean up)
      context.locals = new Set();
      // TODO: Should functions have implicit return?
      // This could be complex, since programs can be empty (I think).
      return `(func ${context.resolveImport(ast.name)} ${locals.join(
        " "
      )} ${body})
        (export "${ast.name}" (func ${context.resolveImport(ast.name)}))`;
    }
    case "SCRIPT": {
      const body = ast.body.map((statement, i) => {
        return `${emit(statement, context)} drop`;
      });

      return body.join("\n");
    }
    case "EXPRESSION_BLOCK": {
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
      const right = emit(ast.right, context);
      const variableName = ast.left.value;
      const global = context.globals.has(variableName);

      // Ensure we have registed this as a local variable.
      if (!global && !context.locals.has(variableName)) {
        context.locals.add(variableName);
      }
      // TODO: Find a way to manage mapping global variables that need a $
      // prefix to EEL variables that cannot use $.

      // TODO: In lots of cases we don't care about the return value. In those
      // cases we should try to find a way to omit the `get/drop` combo.
      // Peephole optimization seems to be the conventional way to do this.
      // https://en.wikipedia.org/wiki/Peephole_optimization

      // TODO: In the cases where we set and then get a local an _don't_ want to
      // drop it, we could use `tee_local`. This might also be a good peephole
      // optimizaiton.
      const get = global
        ? `global.get ${context.resolveGlobal(variableName)}`
        : `get_local ${context.resolveLocal(variableName)}`;
      const set = global
        ? `global.set ${context.resolveGlobal(variableName)}`
        : `set_local ${context.resolveLocal(variableName)}`;

      switch (ast.operator) {
        case "=":
          return `${right} ${set} ${get}`;
        case "+=":
          return `${get} ${right} f64.add ${set} ${get}`;
        case "-=":
          return `${get} ${right} f64.sub ${set} ${get}`;
        case "*=":
          return `${get} ${right} f64.mul ${set} ${get}`;
        case "/=":
          return `${get} ${right} f64.div ${set} ${get}`;
        case "%=":
          return `${get} ${right} call $mod ${set} ${get}`;
        default:
          throw new Error(`Unknown assignment operator "${ast.operator}"`);
      }
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
        return `global.get ${context.resolveGlobal(variableName)}`;
      }
      if (context.locals.has(variableName)) {
        return `local.get ${context.resolveLocal(variableName)}`;
      }
      throw new Error(`Unknown variable "${variableName}"`);
    case "NUMBER_LITERAL":
      return `f64.const ${ast.value}`;
    default:
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { emit };
