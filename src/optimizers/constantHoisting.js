const { mapAst } = require("./astUtils");

// Rather than number literals being inline with the code, this hoists them out
// so that number literals are assigned to a constant start of each function and
// referenced by variable afterwards. Just a silly experiment.
function hoistConstants(rootNode) {
  const constants = new Map();
  let i = 0;
  function resolveConstant(number) {
    if (!constants.has(number)) {
      constants.set(number, `const_${i++}`);
    }
    return constants.get(number);
  }
  return mapAst(rootNode, ast => {
    switch (ast.type) {
      case "SCRIPT":
        const constantAssignments = Array.from(constants).map(([num, name]) => {
          const left = { type: "IDENTIFIER", value: name };
          const right = { type: "NUMBER_LITERAL", value: num };
          return { type: "ASSIGNMENT_EXPRESSION", operator: "=", left, right };
        });
        return { type: "SCRIPT", body: [...constantAssignments, ...ast.body] };
      case "NUMBER_LITERAL":
        return { type: "IDENTIFIER", value: resolveConstant(ast.value) };
    }
    return ast;
  });
}

module.exports = hoistConstants;
