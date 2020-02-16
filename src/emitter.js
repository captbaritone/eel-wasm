const {
  op,
  encodef64,
  unsignedLEB128,
  VAL_TYPE,
  BLOCK,
} = require("./encoding");

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

function emitExpressionBlock(body, context) {
  const statements = body.map((statement, i) => {
    return emit(statement, context);
  });
  return flatten(arrayJoin(statements, [op.drop]));
}

function emitWhile(expression, context) {
  const body = emit(expression, context);
  return [
    op.loop,
    BLOCK.void, // void block type
    ...body,
    op.f64_const,
    ...encodef64(0),
    op.f64_ne,
    op.br_if,
    // TODO: Chasm has these as _signedLEB128_.
    // https://github.com/ColinEberhardt/chasm/blob/c95459af54440661dd69415501d4d52e149c3985/src/emitter.ts#L173
    ...unsignedLEB128(0), // Return to the top of the loop
    op.end,
    op.f64_const,
    ...encodef64(0), // Implicitly return zero
  ];
}

function emitLoop(count, expression, context) {
  const body = emit(expression, context);
  const localIndex = context.resolveLocalF64();
  // TODO: This could probably be simplified
  return [
    // Assign the count to a variable
    ...emit(count, context),
    op.local_set,
    ...unsignedLEB128(localIndex),
    op.loop,
    BLOCK.void, // void block type
    // Run the body
    ...body,
    op.drop,
    // Decrement the count
    op.local_get,
    ...unsignedLEB128(localIndex),
    op.f64_const,
    ...encodef64(1),
    op.f64_sub,
    op.local_tee,
    ...unsignedLEB128(localIndex),
    // Test if we've reached the end
    op.f64_const,
    ...encodef64(0),
    op.f64_ne,
    op.br_if,
    // TODO: Chasm has these as _signedLEB128_.
    // https://github.com/ColinEberhardt/chasm/blob/c95459af54440661dd69415501d4d52e149c3985/src/emitter.ts#L173
    ...unsignedLEB128(0), // Return to the top of the loop
    op.end,
    op.f64_const,
    ...encodef64(0), // Implicitly return zero
  ];
}

function emitConditional(test, consiquent, alternate, context) {
  // TODO: In some cases https://webassembly.studio/ compiles these to use `select`.
  // Is that an optimization that we might want as well?
  return [
    ...emit(test, context),
    op.f64_const,
    ...encodef64(0),
    op.f64_ne,
    op.if,
    VAL_TYPE.f64, // Return type (f64)
    ...emit(consiquent, context),
    op.else,
    ...emit(alternate, context),
    op.end,
  ];
}

function emit(ast, context) {
  switch (ast.type) {
    case "SCRIPT": {
      const body = ast.body.map((statement, i) => {
        return [...emit(statement, context), op.drop];
      });

      return flatten(body);
    }
    case "EXPRESSION_BLOCK": {
      return emitExpressionBlock(ast.body, context);
    }
    case "BINARY_EXPRESSION": {
      const left = emit(ast.left, context);
      const right = emit(ast.right, context);
      switch (ast.operator) {
        case "+":
          return [...left, ...right, op.f64_add];
        case "-":
          return [...left, ...right, op.f64_sub];
        case "*":
          return [...left, ...right, op.f64_mul];
        case "/":
          return [...left, ...right, op.f64_div];
        case "%": {
          const invocation = context.resolveLocalFunc("mod");
          return [...left, ...right, ...invocation];
        }
        case "|": {
          const invocation = context.resolveLocalFunc("bitwiseOr");
          return [...left, ...right, ...invocation];
        }
        case "&": {
          const invocation = context.resolveLocalFunc("bitwiseAnd");
          return [...left, ...right, ...invocation];
        }
        // Comparison operators
        case "==": {
          return [...left, ...right, op.f64_eq, op.f64_convert_i32_s];
        }
        case "<": {
          return [...left, ...right, op.f64_lt, op.f64_convert_i32_s];
        }
        case ">": {
          return [...left, ...right, op.f64_gt, op.f64_convert_i32_s];
        }
        case "<=": {
          return [...left, ...right, op.f64_le, op.f64_convert_i32_s];
        }
        case ">=": {
          return [...left, ...right, op.f64_ge, op.f64_convert_i32_s];
        }
        default:
          throw new Error(`Unknown binary expression operator ${ast.operator}`);
      }
    }
    case "CALL_EXPRESSION": {
      const functionName = ast.callee.value;
      // Some functions have special behavior
      // TODO: Assert arity of these functions
      switch (functionName) {
        case "exec2":
        case "exec3":
          return emitExpressionBlock(ast.arguments, context);
        case "if":
          const [test, consiquent, alternate] = ast.arguments;
          return emitConditional(test, consiquent, alternate, context);
        case "while":
          return emitWhile(ast.arguments[0], context);
        case "loop":
          return emitLoop(ast.arguments[0], ast.arguments[1], context);
      }
      const args = flatten(ast.arguments.map(node => emit(node, context)));

      const invocation = context.resolveLocalFunc(functionName);
      return [...args, ...invocation];
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
      const get = [op.global_get, ...resolvedName];
      const set = [op.global_set, ...resolvedName];

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
          const invocation = context.resolveLocalFunc("mod");
          return [...get, ...right, ...invocation, ...set, ...get];
        default:
          throw new Error(`Unknown assignment operator "${ast.operator}"`);
      }
    }
    case "CONDITIONAL_EXPRESSION": {
      return emitConditional(ast.test, ast.consiquent, ast.alternate, context);
    }
    case "LOGICAL_EXPRESSION": {
      const left = emit(ast.left, context);
      const right = emit(ast.right, context);
      const localIndex = context.resolveLocalF64();
      let equalityOp = null;
      switch (ast.operator) {
        case "&&":
          equalityOp = op.f64_eq;
          break;
        case "||":
          equalityOp = op.f64_ne;
          break;
        default:
          throw new Error(
            `Unknown logical expression operator ${ast.operator}`
          );
      }
      return [
        ...left,
        op.local_tee,
        ...unsignedLEB128(localIndex),
        op.f64_const,
        ...encodef64(0),
        equalityOp,
        op.if,
        VAL_TYPE.f64,
        op.local_get,
        ...unsignedLEB128(localIndex),
        op.else,
        ...right,
        op.end,
      ];
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
      return [op.f64_const, ...encodef64(ast.value)];
    default:
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}

module.exports = { emit };
