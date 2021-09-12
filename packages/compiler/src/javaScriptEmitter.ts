import { Ast } from "./types";

import { createUserError } from "./errorUtils";

function isZeroish(num: string) {
  return `(Math.abs(${num}) < 0.00001)`;
}

function isNotZeroish(num: string) {
  return `(Math.abs(${num}) > 0.00001)`;
}

// prettier-ignore
const MATH_FUNCS = new Set(["abs", "min", "max", "sqrt", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "pow", "log", "log10", "floor", "ceil", "exp"]);

const standardLibrary = `
const megabuf = new Array(1048576).fill(0);
const gmegabuf = new Array(1048576).fill(0);
function sigmoid(x, y) {
  const t = 1 + Math.exp(-x * y);
  return Math.abs(t) > 0.00001 ? 1.0 / t : 0;
}
`;

type Context = {
  rawSource: string;
};

export function emitter(ast: Ast, context: Context): string {
  switch (ast.type) {
    case "SCRIPT": {
      const expressions = ast.body.map(node => {
        return emitter(node, context);
      });
      return standardLibrary + expressions.join(";\n");
    }
    case "EXPRESSION_BLOCK": {
      const expressions = ast.body.map(node => {
        return emitter(node, context);
      });
      return `(${expressions.join(",")})`;
    }
    case "ASSIGNMENT_EXPRESSION": {
      const right = emitter(ast.right, context);
      let assignee: string;
      if (ast.left.type === "CALL_EXPRESSION") {
        const { left } = ast;
        if (left.arguments.length !== 1) {
          throw createUserError(
            `Expected 1 argument when assigning to a buffer but got ${left.arguments.length}.`,
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
        const index = emitter(ast.left.arguments[0], context);
        assignee = `${bufferName}[${index}]`;
      } else {
        assignee = `a["${ast.left.value}"]`;
      }
      return `(${assignee} ${ast.operator} ${right})`;
    }
    case "BINARY_EXPRESSION": {
      const left = emitter(ast.left, context);
      const right = emitter(ast.right, context);
      const { operator } = ast;
      switch (operator) {
        case "^":
          return `Math.pow(${left}, ${right})`;
        case "==": {
          return `+${isZeroish(`${left} - ${right}`)}`;
        }
        case "!=": {
          return `+${isNotZeroish(`${left} - ${right}`)}`;
        }
        default:
          return `+(${left} ${ast.operator} ${right})`;
      }
    }
    case "UNARY_EXPRESSION": {
      const value = emitter(ast.value, context);
      const { operator } = ast;
      switch (operator) {
        case "!":
          return `+${isZeroish(value)}`;
        default:
          return `(${ast.operator}${value})`;
      }
    }
    case "LOGICAL_EXPRESSION": {
      const left = emitter(ast.left, context);
      const right = emitter(ast.right, context);
      return `+(!!(${left} ${ast.operator} ${right}))`;
    }

    case "CALL_EXPRESSION": {
      const functionName = ast.callee.value;
      const args = ast.arguments.map(arg => {
        return emitter(arg, context);
      });
      if (MATH_FUNCS.has(functionName)) {
        return `Math.${functionName}(${args.join(",")})`;
      }
      switch (functionName) {
        case "sign":
          // Hack to handle -0 https://stackoverflow.com/a/53135516/12631177
          return `(Math.sign(${args[0]})+0)`;
        case "int":
          return `Math.floor(${args[0]})`;
        case "bor":
          return `(function() {
            var x = ${isNotZeroish(args[0])}
            var y = ${isNotZeroish(args[1])}
            return x ? 1 : +y;
          })()`;
        case "band":
          return `(function() {
            var x = ${isNotZeroish(args[0])}
            var y = ${isNotZeroish(args[1])}
            return x ? +y : 0;
          })()`;
        case "bnot":
          return `+${isZeroish(args[0])}`;
        case "sqr":
          return `(function(){
            var temp = ${args[0]};
            return temp * temp;
          })()`;
        case "assign": {
          const identifier = ast.arguments[0];
          if (identifier.type !== "IDENTIFIER") {
            throw createUserError(
              "Expected the first argument of `assign()` to be an identifier.",
              identifier.loc,
              context.rawSource
            );
          }
          return `(a["${identifier.value}"] = ${args[1]})`;
        }
        case "if":
          return `(${args[0]} ? ${args[1]} : ${args[2]})`;
        case "above":
          return `+(${args[0]} > ${args[1]})`;
        case "below":
          return `+(${args[0]} < ${args[1]})`;
        case "equal":
          return `+(${args[0]} === ${args[1]})`;
        case "sigmoid":
          return `sigmoid(${args[0]}, ${args[1]})`;
        case "exec2":
        case "exec3":
          return `(${args.join(", ")})`;
        // TODO: Should loop or while return something?
        case "loop":
          return `for(var count = ${args[0]}; count > 0; count--) ${args[1]}`;
        case "while":
          return `while(${args[0]}) {}`;
        case "megabuf":
          return `megabuf[${args[0]}]`;
        case "gmegabuf":
          return `gmegabuf[${args[0]}]`;
        default:
          throw new Error(`Unknown function ${functionName}`);
      }
    }
    case "NUMBER_LITERAL": {
      return String(ast.value);
    }
    case "IDENTIFIER": {
      return `a["${ast.value}"]`;
    }
  }
}
