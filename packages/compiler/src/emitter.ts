import {
  op,
  encodef64,
  unsignedLEB128,
  VAL_TYPE,
  BLOCK,
  IS_ZEROISH,
  IS_NOT_ZEROISH,
} from "./encoding";
import shims from "./shims";
import { createUserError, createCompilerError } from "./errorUtils";
import { Ast, CompilerContext, AssignmentOperator } from "./types";
import { localFuncMap } from "./wasmFunctions";

function arrayJoin<T1, T2>(arr: T1[], joiner: T2): Array<T1 | T2> {
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

function flatten<T>(arr: Array<T[]>): T[] {
  const newArr: T[] = [];
  arr.forEach(subArr => {
    newArr.push(...subArr);
  });
  return newArr;
}

function emitExpressionBlock(body: Ast[], context: CompilerContext) {
  const statements = body.map((statement, i) => {
    return emit(statement, context);
  });
  return flatten(arrayJoin(statements, [op.drop]));
}

function emitWhile(expression: Ast, context: CompilerContext) {
  const body = emit(expression, context);
  return [
    op.loop,
    BLOCK.void, // void block type
    ...body,
    ...IS_NOT_ZEROISH,
    op.br_if,
    // TODO: Chasm has these as _signedLEB128_.
    // https://github.com/ColinEberhardt/chasm/blob/c95459af54440661dd69415501d4d52e149c3985/src/emitter.ts#L173
    ...unsignedLEB128(0), // Return to the top of the loop
    op.end,
    op.f64_const,
    ...encodef64(0), // Implicitly return zero
  ];
}

function emitLoop(count: Ast, expression: Ast, context: CompilerContext) {
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
    ...IS_NOT_ZEROISH,
    op.br_if,
    // TODO: Chasm has these as _signedLEB128_.
    // https://github.com/ColinEberhardt/chasm/blob/c95459af54440661dd69415501d4d52e149c3985/src/emitter.ts#L173
    ...unsignedLEB128(0), // Return to the top of the loop
    op.end,
    op.f64_const,
    ...encodef64(0), // Implicitly return zero
  ];
}

function emitConditional(
  test: Ast,
  consiquent: Ast,
  alternate: Ast,
  context: CompilerContext
) {
  // TODO: In some cases https://webassembly.studio/ compiles these to use `select`.
  // Is that an optimization that we might want as well?
  return [
    ...emit(test, context),
    ...IS_NOT_ZEROISH,
    op.if,
    VAL_TYPE.f64, // Return type (f64)
    ...emit(consiquent, context),
    op.else,
    ...emit(alternate, context),
    op.end,
  ];
}

// If `set` requires an index (for example for memory stores) then you can pass
// a non-empty `index` which will array which will leave the index on the stack
// before the value in `right`. For `set` calls that don't (for example global
// variables), simply pass an empty `index` array.
function emitAssignment(
  {
    index,
    right,
    set,
    get,
    operator,
  }: {
    index: number[];
    right: number[];
    set: number[];
    get: number[];
    operator: AssignmentOperator;
  },
  context: CompilerContext
) {
  // `=` is a special case in that it does not need the original value.
  if (operator === "=") {
    return [...index, ...right, ...set, ...get];
  }
  const operatorToCode = {
    "+=": [op.f64_add],
    "-=": [op.f64_sub],
    "*=": [op.f64_mul],
    "/=": [op.f64_div],
    "%=": context.resolveLocalFunc("mod"),
  };
  const code = operatorToCode[operator];
  if (code == null) {
    throw new Error(`Unknown assignment operator "${operator}"`);
  }
  return [...index, ...get, ...right, ...code, ...set, ...get];
}

// There are two sections of memory. This function emits code to add the correct
// offset to an i32 index already on the stack.
function emitAddMemoryOffset(name: "gmegabuf" | "megabuf"): number[] {
  const nameToCode = {
    gmegabuf: [
      op.i32_const,
      // TODO: Is this the right encoding for an int32?
      ...unsignedLEB128(1000000),
      op.i32_add,
    ],
    megabuf: [] as number[],
  };
  const code = nameToCode[name];
  if (code == null) {
    throw new Error(`Invalid memory name ${name}`);
  }
  return code;
}

export function emit(ast: Ast, context: CompilerContext): number[] {
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
      const operatorToOps = {
        "+": [op.f64_add],
        "-": [op.f64_sub],
        "*": [op.f64_mul],
        "/": [op.f64_div],
        "%": context.resolveLocalFunc("mod"),
        "|": context.resolveLocalFunc("bitwiseOr"),
        "&": context.resolveLocalFunc("bitwiseAnd"),
        "^": context.resolveLocalFunc("pow"),
        // Comparison operators
        "==": [op.f64_sub, ...IS_ZEROISH, op.f64_convert_i32_s],
        "!=": [op.f64_sub, ...IS_NOT_ZEROISH, op.f64_convert_i32_s],
        "<": [op.f64_lt, op.f64_convert_i32_s],
        ">": [op.f64_gt, op.f64_convert_i32_s],
        "<=": [op.f64_le, op.f64_convert_i32_s],
        ">=": [op.f64_ge, op.f64_convert_i32_s],
      };
      const code = operatorToOps[ast.operator];
      if (code == null) {
        throw new Error(`Unknown binary expression operator ${ast.operator}`);
      }
      return [...left, ...right, ...code];
    }
    case "CALL_EXPRESSION": {
      const functionName = ast.callee.value;

      // Destructure this so that TypeScript knows it won't get mutated.
      const argList = ast.arguments;

      const assertArity = (arity: number) => {
        if (argList.length < arity) {
          throw createUserError(
            `Too few arguments passed to \`${functionName}()\`. Expected ${arity} but only got ${argList.length}.`,
            ast.loc,
            context.rawSource
          );
        }
        if (argList.length > arity) {
          throw createUserError(
            `Too many arguments passed to \`${functionName}()\`. Expected ${arity} but got ${argList.length}.`,
            argList[arity].loc,
            context.rawSource
          );
        }
      };

      const args: number[] = flatten(
        ast.arguments.map(node => emit(node, context))
      );

      // Some functions have special behavior
      // TODO: Assert arity of these functions
      switch (functionName) {
        case "exec2":
          assertArity(2);
          return emitExpressionBlock(ast.arguments, context);
        case "exec3":
          assertArity(3);
          return emitExpressionBlock(ast.arguments, context);
        case "if":
          assertArity(3);
          const [test, consiquent, alternate] = ast.arguments;
          return emitConditional(test, consiquent, alternate, context);
        case "while":
          assertArity(1);
          return emitWhile(ast.arguments[0], context);
        case "loop":
          assertArity(2);
          return emitLoop(ast.arguments[0], ast.arguments[1], context);
        case "megabuf":
        case "gmegabuf":
          assertArity(1);
          return [
            ...emit(ast.arguments[0], context),
            op.i32_trunc_s_f64,
            ...emitAddMemoryOffset(functionName),
            op.f64_load,
            0x03, // Align
            0x00, // Offset
          ];
        case "assign":
          assertArity(2);
          const variableIdentifier = ast.arguments[0];
          if (variableIdentifier.type != "IDENTIFIER") {
            throw createUserError(
              "Expected the first argument of `assign()` to be an identifier.",
              variableIdentifier.loc,
              context.rawSource
            );
          }
          const resolvedName = context.resolveVar(variableIdentifier.value);
          return [
            ...emit(ast.arguments[1], context),
            op.global_set,
            ...resolvedName,
            op.global_get,
            ...resolvedName,
          ];
        // Function calls which can be linlined
        case "abs":
          assertArity(1);
          return [...args, op.f64_abs];
        case "sqrt":
          assertArity(1);
          return [...args, op.f64_sqrt];
        case "int":
          assertArity(1);
          return [...args, op.f64_floor];
        case "min":
          assertArity(2);
          return [...args, op.f64_min];
        case "max":
          assertArity(2);
          return [...args, op.f64_max];
        case "above":
          assertArity(2);
          return [...args, op.f64_gt, op.f64_convert_i32_s];
        case "below":
          assertArity(2);
          return [...args, op.f64_lt, op.f64_convert_i32_s];
        case "equal":
          assertArity(2);
          return [...args, op.f64_sub, ...IS_ZEROISH, op.f64_convert_i32_s];
        case "bnot":
          assertArity(1);
          return [...args, ...IS_ZEROISH, op.f64_convert_i32_s];
      }

      const invocation = context.resolveLocalFunc(functionName);
      if (invocation == null) {
        throw createUserError(
          `"${functionName}" is not defined.`,
          ast.callee.loc,
          context.rawSource
        );
      }

      if (shims[functionName] != null) {
        assertArity(shims[functionName].length);
      } else if (localFuncMap[functionName] != null) {
        assertArity(localFuncMap[functionName].args.length);
      } else {
        throw createCompilerError(
          `Missing arity information for the function \`${functionName}()\``,
          ast.callee.loc,
          context.rawSource
        );
      }
      return [...args, ...invocation];
    }
    case "ASSIGNMENT_EXPRESSION": {
      // There's a special assignment case for `megabuf(n) = e` and `gmegabuf(n) = e`.
      if (ast.left.type == "CALL_EXPRESSION") {
        const localIndex = context.resolveLocalF64();
        const { operator, left } = ast;
        if (ast.left.arguments.length !== 1) {
          throw createUserError(
            `Expected 1 argument when assinging to a buffer`,
            ast.loc,
            context.rawSource
          );
        }

        const bufferName = left.callee.value;
        if (bufferName !== "gmegabuf" && bufferName !== "megabuf") {
          throw createUserError(
            "The only function calls which may be assigned to are `gmegabuf()` and `megabuf()`.",
            left.callee.loc,
            context.rawSource
          );
        }

        const addOffset = emitAddMemoryOffset(bufferName);

        const index = [
          ...emit(ast.left.arguments[0], context),
          op.local_tee,
          ...unsignedLEB128(localIndex),
          op.i32_trunc_s_f64,
          ...addOffset,
        ];
        const right = emit(ast.right, context);
        const set = [op.f64_store, 0x03, 0x00];
        const get = [
          op.local_get,
          ...unsignedLEB128(localIndex),
          // TODO: We could avoid this casting and applying the offset twice if
          // we supported local ints
          op.i32_trunc_s_f64,
          ...addOffset,
          op.f64_load,
          0x03,
          0x00,
        ];
        return emitAssignment({ index, right, set, get, operator }, context);
      }
      const right = emit(ast.right, context);
      const variableName = ast.left.value;

      const resolvedName = context.resolveVar(variableName);

      // TODO: In lots of cases we don't care about the return value. In those
      // cases we should try to find a way to omit the `get/drop` combo.
      // Peephole optimization seems to be the conventional way to do this.
      // https://en.wikipedia.org/wiki/Peephole_optimization
      const get = [op.global_get, ...resolvedName];
      const set = [op.global_set, ...resolvedName];
      const { operator } = ast;
      const index: number[] = [];

      return emitAssignment({ index, right, set, get, operator }, context);
    }
    case "LOGICAL_EXPRESSION": {
      const left = emit(ast.left, context);
      const right = emit(ast.right, context);
      const behaviorMap = {
        "&&": {
          comparison: IS_ZEROISH,
          shortCircutValue: 0,
        },
        "||": {
          comparison: IS_NOT_ZEROISH,
          shortCircutValue: 1,
        },
      };
      const behavior = behaviorMap[ast.operator];

      if (behavior == null) {
        throw new Error(`Unknown logical expression operator ${ast.operator}`);
      }
      const { comparison, shortCircutValue } = behavior;
      return [
        ...left,
        ...comparison,
        op.if,
        VAL_TYPE.f64,
        op.f64_const,
        ...encodef64(shortCircutValue),
        op.else,
        ...right,
        ...IS_NOT_ZEROISH,
        op.f64_convert_i32_s,
        op.end,
      ];
    }

    case "UNARY_EXPRESSION": {
      const value = emit(ast.value, context);
      const operatorToCode = {
        "-": [op.f64_neg],
        "+": [] as number[],
        "!": [...IS_ZEROISH, op.f64_convert_i32_s],
      };
      const code = operatorToCode[ast.operator];
      if (code == null) {
        throw new Error(`Unknown unary operator ${ast.operator}`);
      }
      return [...value, ...code];
    }
    case "IDENTIFIER":
      const variableName = ast.value;
      // TODO: It's a bit odd that not every IDENTIFIER node gets emitted. In
      // function calls and assignments we just peek at the name and never emit
      // it.
      return [op.global_get, ...context.resolveVar(variableName)];
    case "NUMBER_LITERAL":
      return [op.f64_const, ...encodef64(ast.value)];
    default:
      // @ts-ignore This runtime check is here because the caller may not be type-checked
      throw new Error(`Unknown AST node type ${ast.type}`);
  }
}