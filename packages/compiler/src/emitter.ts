import { op, VAL_TYPE, BLOCK, IS_ZEROISH, IS_NOT_ZEROISH } from "./encoding";
import shims from "./shims";
import { createUserError, createCompilerError } from "./errorUtils";
import { Ast, CompilerContext, AssignmentExpressionAstNode } from "./types";
import { localFuncMap } from "./wasmFunctions";
import { flatten, arrayJoin } from "./utils";
import { BUFFER_SIZE, MAX_LOOP_COUNT } from "./constants";

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
        "/": context.resolveFunc("div"),
        "%": context.resolveFunc("mod"),
        "|": context.resolveFunc("bitwiseOr"),
        "&": context.resolveFunc("bitwiseAnd"),
        "^": context.resolveFunc("pow"),
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
        throw createCompilerError(
          `Unknown binary expression operator ${ast.operator}`,
          ast.loc,
          context.rawSource
        );
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

      // Some functions have special behavior
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
          const index = context.resolveLocal(VAL_TYPE.i32);
          return [
            ...emit(ast.arguments[0], context),
            ...context.resolveFunc("_getBufferIndex"),
            ...op.local_tee(index),
            ...op.i32_const(-1),
            op.i32_ne,
            // STACK: [in range]
            ...op.if(BLOCK.f64),
            ...op.local_get(index),
            ...op.f64_load(3, emitAddMemoryOffset(functionName)),
            op.else,
            ...op.f64_const(0),
            op.end,
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
            ...op.global_set(resolvedName),
            ...op.global_get(resolvedName),
          ];
      }

      // Function calls which can be linlined
      const args = flatten(ast.arguments.map(node => emit(node, context)));
      // This is just a continuation of the above switch statement, but it's for functions which all parse their args the same.
      switch (functionName) {
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
        case "floor":
          assertArity(1);
          return [...args, op.f64_floor];
        case "ceil":
          assertArity(1);
          return [...args, op.f64_ceil];
      }

      const invocation = context.resolveFunc(functionName);
      if (
        invocation == null ||
        // Ensure this isn't a private function. This is a bit awkward becuase
        // Eel does implement some _ functions but while they are _intended_ to be
        // private, they accidentally expose them. We should find a cleaner way
        // to defining user accessible functions vs utility functions used by
        // the compiler.
        functionName.startsWith("_")
      ) {
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
      const { left } = ast;
      const rightCode = emit(ast.right, context);
      const mutationCode = getAssignmentOperatorMutation(ast, context);

      if (left.type === "IDENTIFIER") {
        const resolvedName = context.resolveVar(left.value);

        // TODO: In lots of cases we don't care about the return value. In those
        // cases we should try to find a way to omit the `get/drop` combo.
        // Peephole optimization seems to be the conventional way to do this.
        // https://en.wikipedia.org/wiki/Peephole_optimization
        const get = op.global_get(resolvedName);
        const set = op.global_set(resolvedName);

        // `=` is a special case in that it does not need the original value.
        if (mutationCode === null) {
          return [...rightCode, ...set, ...get];
        }

        return [...get, ...rightCode, ...mutationCode, ...set, ...get];
      }

      if (left.type !== "CALL_EXPRESSION") {
        throw createCompilerError(
          // @ts-ignore This is a guard in case the parser has an error
          `Unexpected left hand side type for assignment: ${left.type}`,
          ast.loc,
          context.rawSource
        );
      }

      // Special assignment case for `megabuf(n) = e` and `gmegabuf(n) = e`.
      const localIndex = context.resolveLocal(VAL_TYPE.i32);
      if (left.arguments.length !== 1) {
        throw createUserError(
          `Expected 1 argument when assinging to a buffer but got ${left.arguments.length}.`,
          left.arguments.length === 0 ? left.loc : left.arguments[1].loc,
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
      if (mutationCode === null) {
        // TODO: Move this to wasmFunctions once we know how to call functions
        // from within functions (need to get the offset).
        const unnormalizedIndex = context.resolveLocal(VAL_TYPE.i32);
        const rightValue = context.resolveLocal(VAL_TYPE.f64);
        return [
          // Emit the right hand side unconditionally to ensure it always runs.
          ...rightCode,
          ...op.local_set(rightValue),
          ...emit(left.arguments[0], context),
          ...context.resolveFunc("_getBufferIndex"),
          ...op.local_tee(unnormalizedIndex),
          ...op.i32_const(0),
          op.i32_lt_s,
          // STACK: [is the index out of range?]
          ...op.if(BLOCK.f64),
          ...op.f64_const(0),
          op.else,
          ...op.local_get(unnormalizedIndex),
          ...op.local_tee(localIndex),
          // STACK: [buffer index]
          ...op.local_get(rightValue),
          // STACK: [buffer index, right]
          ...op.f64_store(3, addOffset),
          // STACK: []
          ...op.local_get(rightValue),
          // STACK: [Right/Buffer value]
          op.end,
        ];
      }

      // TODO: Move this to wasmFunctions once we know how to call functions
      // from within functions (need to get the offset).
      const index = context.resolveLocal(VAL_TYPE.i32);
      const inBounds = context.resolveLocal(VAL_TYPE.i32);
      const rightValue = context.resolveLocal(VAL_TYPE.f64);
      const result = context.resolveLocal(VAL_TYPE.f64);
      return [
        ...rightCode,
        ...op.local_set(rightValue),
        ...emit(left.arguments[0], context),
        ...context.resolveFunc("_getBufferIndex"),
        ...op.local_tee(index),
        // STACK: [index]
        ...op.i32_const(-1),
        op.i32_ne,
        ...op.local_tee(inBounds),
        ...op.if(BLOCK.f64),
        ...op.local_get(index),
        ...op.f64_load(3, addOffset),
        op.else,
        ...op.f64_const(0),
        op.end,
        // STACK: [current value from memory || 0]

        // Apply the mutation
        ...op.local_get(rightValue),
        ...mutationCode,

        ...op.local_tee(result),
        // STACK: [new value]

        ...op.local_get(inBounds),
        ...op.if(BLOCK.void),
        ...op.local_get(index),
        ...op.local_get(result),
        ...op.f64_store(3, addOffset),
        op.end,
      ];
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
        throw createCompilerError(
          `Unknown logical expression operator ${ast.operator}`,
          ast.loc,
          context.rawSource
        );
      }
      const { comparison, shortCircutValue } = behavior;
      return [
        ...left,
        ...comparison,
        ...op.if(BLOCK.f64),
        ...op.f64_const(shortCircutValue),
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
        throw createCompilerError(
          `Unknown logical unary operator ${ast.operator}`,
          ast.loc,
          context.rawSource
        );
      }
      return [...value, ...code];
    }
    case "IDENTIFIER":
      const variableName = ast.value;
      // TODO: It's a bit odd that not every IDENTIFIER node gets emitted. In
      // function calls and assignments we just peek at the name and never emit
      // it.
      return op.global_get(context.resolveVar(variableName));
    case "NUMBER_LITERAL":
      return op.f64_const(ast.value);
    default:
      throw createCompilerError(
        // @ts-ignore This runtime check is here because the caller may not be type-checked
        `Unknown AST node type ${ast.type}`,
        // @ts-ignore This runtime check is here because the caller may not be type-checked
        ast.loc,
        context.rawSource
      );
  }
}

function emitExpressionBlock(body: Ast[], context: CompilerContext) {
  const statements = body.map((statement, i) => {
    return emit(statement, context);
  });
  return flatten(arrayJoin(statements, [op.drop]));
}

function emitWhile(expression: Ast, context: CompilerContext): number[] {
  const body = emit(expression, context);
  const iterationCount = context.resolveLocal(VAL_TYPE.i32);
  return [
    ...op.i32_const(0),
    ...op.local_set(iterationCount),

    ...op.loop(BLOCK.void),

    // Increment and check loop count
    ...op.local_get(iterationCount),
    ...op.i32_const(1),
    op.i32_add,
    ...op.local_tee(iterationCount),
    // STACK: [iteration count]
    ...op.i32_const(MAX_LOOP_COUNT),
    op.i32_lt_u,
    // STACK: [loop in range]

    ...body,
    ...IS_NOT_ZEROISH,
    // STACK: [loop in range, body is truthy]
    op.i32_and,
    // STACK: [can continue]
    ...op.br_if(0), // Return to the top of the loop
    op.end,
    ...op.f64_const(0), // Implicitly return zero
  ];
}

function emitLoop(
  count: Ast,
  expression: Ast,
  context: CompilerContext
): number[] {
  const body = emit(expression, context);
  const localIndex = context.resolveLocal(VAL_TYPE.f64);

  // TODO: This could probably be simplified
  return [
    // Assign the count to a variable
    ...emit(count, context),
    ...op.local_set(localIndex),
    ...op.loop(BLOCK.void),
    // Run the body
    ...body,
    op.drop,
    // Decrement the count
    ...op.local_get(localIndex),
    ...op.f64_const(1),
    op.f64_sub,
    ...op.local_tee(localIndex),
    // Test if we've reached the end
    ...IS_NOT_ZEROISH,
    ...op.br_if(0), // Return to the top of the loop
    op.end,
    ...op.f64_const(0), // Implicitly return zero
  ];
}

function emitConditional(
  test: Ast,
  consiquent: Ast,
  alternate: Ast,
  context: CompilerContext
): number[] {
  // TODO: In some cases https://webassembly.studio/ compiles these to use `select`.
  // Is that an optimization that we might want as well?
  return [
    ...emit(test, context),
    ...IS_NOT_ZEROISH,
    ...op.if(BLOCK.f64),
    ...emit(consiquent, context),
    op.else,
    ...emit(alternate, context),
    op.end,
  ];
}

// There are two sections of memory. This function emits code to add the correct
// offset to an i32 index already on the stack.
function emitAddMemoryOffset(name: "gmegabuf" | "megabuf"): number {
  switch (name) {
    case "gmegabuf":
      return BUFFER_SIZE * 8;
    case "megabuf":
      return 0;
  }
}

function getAssignmentOperatorMutation(
  ast: AssignmentExpressionAstNode,
  context: CompilerContext
): number[] | null {
  const operatorToCode = {
    "+=": [op.f64_add],
    "-=": [op.f64_sub],
    "*=": [op.f64_mul],
    "/=": [op.f64_div],
    "%=": context.resolveFunc("mod"),
    "=": null,
  };
  const operatorCode = operatorToCode[ast.operator];
  if (operatorCode === undefined) {
    throw createCompilerError(
      `Unknown assignment operator "${ast.operator}"`,
      ast.loc,
      context.rawSource
    );
  }
  return operatorCode;
}
