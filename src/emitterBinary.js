const shims = require("./shims");

const BINARY = true;

function makeNamespaceResolver(prefix) {
  let counter = -1;
  const map = new Map();
  return name => {
    if (!map.has(name)) {
      counter++;
      map.set(name, counter);
    }
    return `$${prefix}${map.get(name)}`;
  };
}

function arrayJoin(arr, joiner) {
  const newArr = [];
  for (let i = 0; i < arr.length; i++) {
    newArr.push(arr[i]);
    const last = i === arr.length - 1;
    if (!last) {
      newArr.push(joiner);
    }
  }
  return newArr;
}

function flatten(arr) {
  const newArr = [];
  arr.forEach(subArr => {
    newArr.push(...subArr);
  });
  return newArr;
}

const op = {
  select: "select",
  call: "call",
  drop: "drop",
  get_local: "get_local",
  i32_or: "i32.or",
  i32_const: "i32.const",
  i32_ne: "i32.ne",
  i32_sub: "i32.sub",
  i32_eqz: "i32.eqz",
  i32_trunc_s_f64: "i32.trunc_s/f64",
  i64_and: "i64.and",
  i64_or: "i64.or",
  i64_rem_s: "i64.rem_s",
  i64_trunc_s_f64: "i64.trunc_s/f64",
  f64_const: "f64.const",
  f64_ne: "f64.ne",
  f64_neg: "f64.neg",
  f64_add: "f64.add",
  f64_sub: "f64.sub",
  f64_mul: "f64.mul",
  f64_div: "f64.div",
  f64_lt: "f64.lt",
  f64_abs: "f64.abs",
  f64_sqrt: "f64.sqrt",
  f64_floor: "f64.floor",
  f64_min: "f64.min",
  f64_max: "f64.max",
  f64_gt: "f64.gt",
  f64_eq: "f64.eq",
  f64_lt: "f64.lt",
  f64_convert_s_i32: "f64.convert_s/i32",
  f64_convert_s_i64: "f64.convert_s/i64",
  f64_convert_i32_s: "f64.convert_i32_s",
  global_get: "global.get",
  global_set: "global.set"
};

if (BINARY) {
  op.drop = 0x1a;
  op.f64_const = 0x44;
}

const valueType = {
  f64: "f64"
};

// We do a little hack here. We wrap every opcode. In an object that stringifies to
// the original string this allows us todo a test in `joinCode` to see if anyone
// is using a string where they should be using the constant.
Object.keys(op).forEach(opKey => {
  op[opKey] = op[opKey];
});

// Having a choke point where all code gets joined will let us make assertions
// about code before it gets stringified. This will help as we migrate to binary
// output.
function joinCode(arr) {
  return arr.join(" ");
}

function funcName(name) {
  return name;
}

function paramName(name) {
  return name;
}

function float(number) {
  return number;
}

function int(number) {
  return number;
}

// TODO: These functions could either be lazily added (only appended when used)
// or inlined.
const STANDARD_LIBRARY = `
;; TODO: We should double check that this does not short circut
(func $if (param $test f64) (param $consiquent f64) (param $alternate f64) (result f64) 
  ${joinCode([
    op.get_local,
    paramName("$consiquent"),
    op.get_local,
    paramName("$alternate"),
    op.get_local,
    paramName("$test"),
    op.f64_const,
    float(0),
    op.f64_ne,
    op.select
  ])}
)
;; TODO: Simplify all this type coersion
(func $booleanOr (param $a f64) (param $b f64) (result f64) 
  ${joinCode([
    op.get_local,
    paramName("$a"),
    op.i32_trunc_s_f64,
    op.get_local,
    paramName("$b"),
    op.i32_trunc_s_f64,
    op.i32_or,
    op.i32_const,
    int(0),
    op.i32_ne,
    op.f64_convert_s_i32
  ])}
)
(func $mod (param $a f64) (param $b f64) (result f64) 
  ${joinCode([
    op.get_local,
    paramName("$a"),
    op.i64_trunc_s_f64,
    op.get_local,
    paramName("$b"),
    op.i64_trunc_s_f64,
    op.i64_rem_s,
    op.f64_convert_s_i64
  ])}
)
(func $bitwiseAnd (param $a f64) (param $b f64) (result f64) 
  ${joinCode([
    op.get_local,
    paramName("$a"),
    op.i64_trunc_s_f64,
    op.get_local,
    paramName("$b"),
    op.i64_trunc_s_f64,
    op.i64_and,
    op.f64_convert_s_i64
  ])})
(func $bitwiseOr (param $a f64) (param $b f64) (result f64) 
  ${joinCode([
    op.get_local,
    paramName("$a"),
    op.i64_trunc_s_f64,
    op.get_local,
    paramName("$b"),
    op.i64_trunc_s_f64,
    op.i64_or,
    op.f64_convert_s_i64
  ])}
)
(func $booleanNot (param $x f64) (result f64) 
  ${joinCode([
    op.get_local,
    paramName("$x"),
    op.i32_trunc_s_f64,
    op.i32_eqz,
    op.f64_convert_s_i32
  ])})
(func $sqr (param $x f64) (result f64) 
  ${joinCode([
    op.get_local,
    paramName("$x"),
    op.get_local,
    paramName("$x"),
    op.f64_mul
  ])}
)
(func $sign (param $x f64) (result f64) 
  ${joinCode([
    op.f64_const,
    float(0),
    op.get_local,
    paramName("$x"),
    op.f64_lt,
    op.get_local,
    paramName("$x"),
    op.f64_const,
    float(0),
    op.f64_lt,
    op.i32_sub,
    op.f64_convert_s_i32
  ])})
`;

const BINARY_OPERATORS = {
  "+": [op.f64_add],
  "-": [op.f64_sub],
  "*": [op.f64_mul],
  "/": [op.f64_div],
  "%": [op.call, funcName("$mod")],
  "|": [op.call, funcName("$bitwiseOr")],
  "&": [op.call, funcName("$bitwiseAnd")]
};

const FUNCTIONS = {
  abs: { arity: 1, instruction: [op.f64_abs] },
  sqrt: { arity: 1, instruction: [op.f64_sqrt] },
  sqr: { arity: 1, instruction: [op.call, funcName("$sqr")] },
  sign: { arity: 1, instruction: [op.call, funcName("$sign")] },
  // TODO: What's the difference between trunc and floor?
  // TODO: Is a rounded float the right thing here, or do we want an int?
  int: { arity: 1, instruction: [op.f64_floor] },
  min: { arity: 2, instruction: [op.f64_min] },
  max: { arity: 2, instruction: [op.f64_max] },
  // We use `lt` here rather than `gt` because the stack is backwards.
  above: { arity: 2, instruction: [op.f64_lt, op.f64_convert_i32_s] },
  // We use `gt` here rather than `lt` because the stack is backwards.
  below: { arity: 2, instruction: [op.f64_gt, op.f64_convert_i32_s] },
  equal: { arity: 2, instruction: [op.f64_eq, op.f64_convert_i32_s] },
  bnot: { arity: 1, instruction: [op.call, funcName("$booleanNot")] },
  bor: { arity: 2, instruction: [op.call, funcName("$booleanOr")] },
  if: { arity: 3, instruction: [op.call, funcName("$if")] }
};

Object.entries(shims).forEach(([key, value]) => {
  FUNCTIONS[key] = {
    arity: value.length,
    instruction: [op.call, funcName("$" + key)]
  };
});

function emit(ast, context) {
  switch (ast.type) {
    case "MODULE": {
      // Intialize a new module context. External variables are called
      // `context.globals` for legacy reasonse.
      context.resolveExternalVar = makeNamespaceResolver("E");
      context.resolveImport = makeNamespaceResolver("F");
      context.resolveUserVar = makeNamespaceResolver("U");
      context.userVars = new Set();

      const externals = Array.from(context.globals).map(name => {
        return `(global ${context.resolveExternalVar(
          name
        )} (import "js" "${name}") (mut f64))`;
      });
      const exportedFunctions = ast.exportedFunctions.map(func => {
        return emit(func, context);
      });
      const importedFunctions = Object.entries(shims).map(([key, value]) => {
        const arity = value.length;
        const params = new Array(arity).fill("(param f64)").join(" ");
        return `(func $${key} (import "imports" "${key}") ${params} (result f64))`;
      });
      const userVars = Array.from(context.userVars).map(name => {
        return `(global ${context.resolveUserVar(name)} (mut f64) f64.const 0)`;
      });
      return `(module
        ${externals.join("\n")}
        ${importedFunctions.join("\n")}
        ${STANDARD_LIBRARY}
        ${userVars.join(" ")}
        ${exportedFunctions.join("\n")}
      )`;
    }
    case "FUNCTION_EXPORT": {
      // We do a real join here since from here on out we must have strings
      const body = joinCode(emit(ast.function, context));
      // TODO: Should functions have implicit return?
      // This could be complex, since programs can be empty (I think).
      return `(func ${context.resolveImport(ast.name)}  ${body})
        (export "${ast.name}" (func ${context.resolveImport(ast.name)}))`;
    }
    case "SCRIPT": {
      const body = ast.body.map((statement, i) => {
        return [...emit(statement, context), op.drop];
      });

      return flatten(body);
    }
    case "EXPRESSION_BLOCK": {
      const body = ast.body.map((statement, i) => {
        return emit(statement, context);
      });
      return flatten(arrayJoin(body, [op.drop]));
    }
    case "BINARY_EXPRESSION": {
      const left = emit(ast.left, context);
      const right = emit(ast.right, context);
      const instruction = BINARY_OPERATORS[ast.operator];
      if (instruction == null) {
        throw new Error(`Unknown binary operator ${ast.operator}`);
      }
      return [...left, ...right, ...instruction];
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
      const args = flatten(
        ast.arguments.map(node => {
          return emit(node, context);
        })
      );
      return [...args, ...instruction];
    }
    case "ASSIGNMENT_EXPRESSION": {
      const right = emit(ast.right, context);
      const variableName = ast.left.value;
      const global = context.globals.has(variableName);

      // Ensure we have registed this as a local variable.
      if (!global && !context.userVars.has(variableName)) {
        context.userVars.add(variableName);
      }

      const resolvedName = global
        ? context.resolveExternalVar(variableName)
        : context.resolveUserVar(variableName);

      // TODO: In lots of cases we don't care about the return value. In those
      // cases we should try to find a way to omit the `get/drop` combo.
      // Peephole optimization seems to be the conventional way to do this.
      // https://en.wikipedia.org/wiki/Peephole_optimization
      const get = [op.global_get, resolvedName];
      const set = [op.global_set, resolvedName];

      switch (ast.operator) {
        case "=":
          return [...right, ...set, ...get];
        case "+=":
          return [...get, ...right, op.f64_add, ...set, ...get];
        case "-=":
          return [...get, ...right, op.f64_sub, ...set, ...get];
        case "*=":
          return [...get, ...right, op.f64_mul, ...set, ...get];
        case "/=":
          return [...get, ...right, op.f64_div, ...set, ...get];
        case "%=":
          return [...get, ...right, op.call, funcName("$mod"), ...set, ...get];
        default:
          throw new Error(`Unknown assignment operator "${ast.operator}"`);
      }
    }
    case "CONDITIONAL_EXPRESSION": {
      // TODO: In some cases https://webassembly.studio/ compiles these to use `select`.
      // Is that an optimization that we might want as well?
      const test = emit(ast.test, context);
      const consiquent = emit(ast.consiquent, context);
      const alternate = emit(ast.alternate, context);
      return [
        ...test,
        op.f64_const,
        float(0),
        op.f64_ne,
        "if",
        // TODO: This will have to be cleaned up when we switch to binary
        "(result",
        valueType.f64,
        ")",
        ...consiquent,
        "else",
        ...alternate,
        "end"
      ];
    }
    case "LOGICAL_EXPRESSION": {
      throw new Error("Logical expressions are not implemented yet.");
    }
    case "UNARY_EXPRESSION": {
      const value = emit(ast.value, context);
      switch (ast.operator) {
        case "-":
          return [...value, op.f64_neg];
        case "+":
          return [...value];
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
        return [op.global_get, context.resolveExternalVar(variableName)];
      }
      if (!context.userVars.has(variableName)) {
        // EEL lets you access variables before you define them, so we register
        // each access that we encounter.
        context.userVars.add(variableName);
      }
      return [op.global_get, context.resolveUserVar(variableName)];
    case "NUMBER_LITERAL":
      return [op.f64_const, float(ast.value)];
    default:
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { emit };
