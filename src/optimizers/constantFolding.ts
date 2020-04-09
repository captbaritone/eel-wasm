import { mapAst } from "./astUtils";
import { Ast, BinaryExpressionOperator } from "../types";

const BINARY_EXPRESSIONS: Map<
  BinaryExpressionOperator,
  (left: number, right: number) => number
> = new Map([
  ["+", (left, right) => left + right],
  ["-", (left, right) => left - right],
  ["*", (left, right) => left * right],
  ["/", (left, right) => left / right],
]);

function foldConstants(rootNode: Ast): Ast {
  return mapAst(
    rootNode,
    (ast: Ast): Ast => {
      switch (ast.type) {
        case "UNARY_EXPRESSION":
          const value = ast.value;

          if (value.type === "NUMBER_LITERAL") {
            switch (ast.operator) {
              case "-":
                return { type: "NUMBER_LITERAL", value: -value.value };
              case "+":
                return value;
            }
          }
          return ast;
        case "BINARY_EXPRESSION":
          const { left, right } = ast;
          const func = BINARY_EXPRESSIONS.get(ast.operator);
          if (
            left.type === "NUMBER_LITERAL" &&
            right.type === "NUMBER_LITERAL" &&
            func != null
          ) {
            return {
              type: "NUMBER_LITERAL",
              value: func(left.value, right.value),
            };
          }
          return ast;
      }
      return ast;
    }
  );
}

export default foldConstants;
