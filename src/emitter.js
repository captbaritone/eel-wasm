const shims = require("./shims");

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

// These are temporary functions to help get us from wat to wasm
function cat(arr) {
  return arr;
}

function split(str) {
  return str;
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

// TODO: These functions could either be lazily added (only appended when used)
// or inlined.
const STANDARD_LIBRARY = `
;; TODO: We should double check that this does not short circut
(func $if (param $test f64) (param $consiquent f64) (param $alternate f64) (result f64) 
  ${[
    "get_local",
    "$consiquent",
    "get_local",
    "$alternate",
    "get_local",
    "$test",
    "f64.const",
    0,
    "f64.ne",
    "select"
  ].join(" ")}
)
;; TODO: Simplify all this type coersion
(func $booleanOr (param $a f64) (param $b f64) (result f64) 
  ${[
    "get_local",
    "$a",
    "i32.trunc_s/f64",
    "get_local",
    "$b",
    "i32.trunc_s/f64",
    "i32.or",
    "i32.const",
    0,
    "i32.ne",
    "f64.convert_s/i32"
  ].join(" ")}
)
(func $mod (param $a f64) (param $b f64) (result f64) 
  ${[
    "get_local",
    "$a",
    "i64.trunc_s/f64",
    "get_local",
    "$b",
    "i64.trunc_s/f64",
    "i64.rem_s",
    "f64.convert_s/i64"
  ].join(" ")}
)
(func $bitwiseAnd (param $a f64) (param $b f64) (result f64) 
  ${[
    "get_local",
    "$a",
    "i64.trunc_s/f64",
    "get_local",
    "$b",
    "i64.trunc_s/f64",
    "i64.and",
    "f64.convert_s/i64"
  ].join(" ")})
(func $bitwiseOr (param $a f64) (param $b f64) (result f64) 
  ${[
    "get_local",
    "$a",
    "i64.trunc_s/f64",
    "get_local",
    "$b",
    "i64.trunc_s/f64",
    "i64.or",
    "f64.convert_s/i64"
  ].join(" ")}
)
(func $booleanNot (param $x f64) (result f64) 
  ${["get_local", "$x", "i32.trunc_s/f64", "i32.eqz", "f64.convert_s/i32"].join(
    " "
  )})
(func $sqr (param $x f64) (result f64) 
  ${["get_local", "$x", "get_local", "$x", "f64.mul"].join(" ")}
)
(func $sign (param $x f64) (result f64) 
  ${[
    "f64.const",
    0,
    "get_local",
    "$x",
    "f64.lt",
    "get_local",
    "$x",
    "f64.const",
    0,
    "f64.lt",
    "i32.sub",
    "f64.convert_s/i32"
  ].join(" ")})
`;

const BINARY_OPERATORS = {
  "+": ["f64.add"],
  "-": ["f64.sub"],
  "*": ["f64.mul"],
  "/": ["f64.div"],
  "%": ["call", "$mod"],
  "|": ["call", "$bitwiseOr"],
  "&": ["call", "$bitwiseAnd"]
};

const FUNCTIONS = {
  abs: { arity: 1, instruction: ["f64.abs"] },
  sqrt: { arity: 1, instruction: ["f64.sqrt"] },
  sqr: { arity: 1, instruction: ["call", "$sqr"] },
  sign: { arity: 1, instruction: ["call", "$sign"] },
  // TODO: What's the difference between trunc and floor?
  // TODO: Is a rounded float the right thing here, or do we want an int?
  int: { arity: 1, instruction: ["f64.floor"] },
  min: { arity: 2, instruction: ["f64.min"] },
  max: { arity: 2, instruction: ["f64.max"] },
  // We use `lt` here rather than `gt` because the stack is backwards.
  above: { arity: 2, instruction: ["f64.lt", "f64.convert_i32_s"] },
  // We use `gt` here rather than `lt` because the stack is backwards.
  below: { arity: 2, instruction: ["f64.gt", "f64.convert_i32_s"] },
  equal: { arity: 2, instruction: ["f64.eq", "f64.convert_i32_s"] },
  bnot: { arity: 1, instruction: ["call", "$booleanNot"] },
  bor: { arity: 2, instruction: ["call", "$booleanOr"] },
  if: { arity: 3, instruction: ["call", "$if"] }
};

Object.entries(shims).forEach(([key, value]) => {
  FUNCTIONS[key] = {
    arity: value.length,
    instruction: [`call`, "$" + key]
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
      const body = split(emit(ast.function, context)).join(" ");
      // TODO: Should functions have implicit return?
      // This could be complex, since programs can be empty (I think).
      return `(func ${context.resolveImport(ast.name)}  ${body})
        (export "${ast.name}" (func ${context.resolveImport(ast.name)}))`;
    }
    case "SCRIPT": {
      const body = ast.body.map((statement, i) => {
        return [...split(emit(statement, context)), "drop"];
      });

      return cat(flatten(body));
    }
    case "EXPRESSION_BLOCK": {
      const body = ast.body.map((statement, i) => {
        return split(emit(statement, context));
      });
      return cat(flatten(arrayJoin(body, ["drop"])));
    }
    case "BINARY_EXPRESSION": {
      const left = split(emit(ast.left, context));
      const right = split(emit(ast.right, context));
      const instruction = BINARY_OPERATORS[ast.operator];
      if (instruction == null) {
        throw new Error(`Unknown binary operator ${ast.operator}`);
      }
      return cat([...left, ...right, ...instruction]);
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
          return split(emit(node, context));
        })
      );
      return cat([...args, ...instruction]);
    }
    case "ASSIGNMENT_EXPRESSION": {
      const right = split(emit(ast.right, context));
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
      const get = [`global.get`, resolvedName];
      const set = [`global.set`, resolvedName];

      switch (ast.operator) {
        case "=":
          return cat([...right, ...set, ...get]);
        case "+=":
          return cat([...get, ...right, "f64.add", ...set, ...get]);
        case "-=":
          return cat([...get, ...right, "f64.sub", ...set, ...get]);
        case "*=":
          return cat([...get, ...right, "f64.mul", ...set, ...get]);
        case "/=":
          return cat([...get, ...right, "f64.div", ...set, ...get]);
        case "%=":
          return cat([...get, ...right, "call", "$mod", ...set, ...get]);
        default:
          throw new Error(`Unknown assignment operator "${ast.operator}"`);
      }
    }
    case "CONDITIONAL_EXPRESSION": {
      // TODO: In some cases https://webassembly.studio/ compiles these to use `select`.
      // Is that an optimization that we might want as well?
      const test = split(emit(ast.test, context));
      const consiquent = split(emit(ast.consiquent, context));
      const alternate = split(emit(ast.alternate, context));
      return cat([
        ...test,
        "f64.const",
        0,
        "f64.ne",
        "if",
        // TODO: This will have to be cleaned up when we switch to binary
        "(result",
        "f64)",
        ...consiquent,
        "else",
        ...alternate,
        "end"
      ]);
    }
    case "LOGICAL_EXPRESSION": {
      throw new Error("Logical expressions are not implemented yet.");
    }
    case "UNARY_EXPRESSION": {
      const value = split(emit(ast.value, context));
      switch (ast.operator) {
        case "-":
          return cat([...value, `f64.neg`]);
        case "+":
          return cat([...value]);
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
        return cat([`global.get`, context.resolveExternalVar(variableName)]);
      }
      if (!context.userVars.has(variableName)) {
        // EEL lets you access variables before you define them, so we register
        // each access that we encounter.
        context.userVars.add(variableName);
      }
      return cat([`global.get`, context.resolveUserVar(variableName)]);
    case "NUMBER_LITERAL":
      return cat([`f64.const`, ast.value]);
    default:
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { emit };