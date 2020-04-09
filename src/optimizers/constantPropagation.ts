import { mapAst } from "./astUtils";
import { Ast, NumberLiteralAstNode } from "../types";

function propagateConstants(rootNode: Ast): Ast {
  const constantVariables: Map<string, NumberLiteralAstNode | null> = new Map();
  return mapAst(
    rootNode,
    (ast: Ast): Ast => {
      switch (ast.type) {
        case "ASSIGNMENT_EXPRESSION":
          if (ast.left.type !== "IDENTIFIER") {
            return ast;
          }
          if (ast.operator === "=" && ast.right.type === "NUMBER_LITERAL") {
            constantVariables.set(ast.left.value, ast.right);
          } else {
            constantVariables.set(ast.left.value, null);
          }
          break;
        case "IDENTIFIER":
          const variableName = ast.value;
          const constant = constantVariables.get(variableName);
          if (constant != null) {
            return { type: "NUMBER_LITERAL", value: constant.value };
          }
          break;
      }
      return ast;
    }
  );
}

export default propagateConstants;
