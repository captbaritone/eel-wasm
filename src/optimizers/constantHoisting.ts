import { Ast } from "../types";
import { mapAst } from "./astUtils";

// Rather than number literals being inline with the code, this hoists them out
// so that number literals are assigned to a constant start of each function and
// referenced by variable afterwards. Just a silly experiment.
function hoistConstants(rootNode: Ast): Ast {
  const constants = new Map<number, string>();
  let i = 0;
  function resolveConstant(number: number): string {
    if (!constants.has(number)) {
      constants.set(number, `const_${i++}`);
    }
    return constants.get(number);
  }
  return mapAst(
    rootNode,
    (ast: Ast): Ast => {
      switch (ast.type) {
        case "SCRIPT":
          const constantAssignments = Array.from(constants).map(
            ([num, name]): Ast => {
              const left = {
                type: "IDENTIFIER",
                value: name,
                loc: {
                  first_column: 0,
                  last_column: 0,
                  first_line: 0,
                  last_line: 0,
                },
              } as const;
              const right = { type: "NUMBER_LITERAL", value: num } as const;
              return {
                type: "ASSIGNMENT_EXPRESSION",
                operator: "=",
                left,
                right,
              };
            }
          );
          return {
            type: "SCRIPT",
            body: [...constantAssignments, ...ast.body],
          };
        case "NUMBER_LITERAL":
          return {
            type: "IDENTIFIER",
            value: resolveConstant(ast.value),
            loc: {
              first_column: 0,
              last_column: 0,
              first_line: 0,
              last_line: 0,
            },
          };
      }
      return ast;
    }
  );
}

export default hoistConstants;
