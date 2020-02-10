const { op, encodef64, unsignedLEB128, VAL_TYPE } = require("./encoding");

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

function emit(ast, context) {
  switch (ast.type) {
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
        default:
          throw new Error(`Unknown binary expression operator ${ast.operator}`);
      }
    }
    case "CALL_EXPRESSION": {
      const args = flatten(
        ast.arguments.map(node => {
          return emit(node, context);
        })
      );
      const functionName = ast.callee.value;
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
      // TODO: In some cases https://webassembly.studio/ compiles these to use `select`.
      // Is that an optimization that we might want as well?
      const test = emit(ast.test, context);
      const consiquent = emit(ast.consiquent, context);
      const alternate = emit(ast.alternate, context);
      return [
        ...test,
        op.f64_const,
        ...encodef64(0),
        op.f64_ne,
        op.if,
        VAL_TYPE.f64, // Return type (f64)
        ...consiquent,
        op.else,
        ...alternate,
        op.end,
      ];
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
    /*
    case "WHILE_STATEMENT": {
      const test = emit(ast.test, context);
      const body = emit(ast.body, context);
      return [
        op.block,
        0x40, // void block type
        op.loop,
        0x40, // void block type
        ...test,
        op.f64_const,
        ...encodef64(0),
        op.f64_eq,
        op.br_if,
        // TODO: Chasm has these as _signedLEB128_.
        // https://github.com/ColinEberhardt/chasm/blob/c95459af54440661dd69415501d4d52e149c3985/src/emitter.ts#L173
        ...unsignedLEB128(1), // Break out of the loop
        ...body,
        op.br,
        ...unsignedLEB128(0), // Return to the top of the loop
        op.end,
        op.end,
        op.f64_const,
        ...encodef64(0), // Implicitly return zero
      ];
    }
    */
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
