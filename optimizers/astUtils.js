const CHILDREN = {
  MODULE: [{ type: "ARRAY", key: "exportedFunctions" }],
  FUNCTION_EXPORT: [{ type: "NODE", key: "function" }],
  ASSIGNMENT_EXPRESSION: [
    { type: "NODE", key: "left" },
    { type: "NODE", key: "right" }
  ],
  SCRIPT: [{ type: "ARRAY", key: "body" }],
  EXPRESSION_BLOCK: [{ type: "ARRAY", key: "body" }],
  UNARY_EXPRESSION: [{ type: "NODE", key: "value" }],
  NUMBER_LITERAL: [],
  IDENTIFIER: [],
  CALL_EXPRESSION: [{type: "ARRAY", key: "arguments"}, {type: "NODE", key: "callee"}],
  BINARY_EXPRESSION: [
    { type: "NODE", key: "left" },
    { type: "NODE", key: "right" }
  ],
  CONDITIONAL_EXPRESSION: [
    { type: "NODE", key: "test" },
    { type: "NODE", key: "consiquent" },
    { type: "NODE", key: "alternate" }
  ]
};

function mapAst(ast, cb) {
  const children = CHILDREN[ast.type];
  let newAst = ast;
  if (children != null) {
    children.forEach(child => {
      if (child.type === "NODE") {
        const orignalChild = ast[child.key];
        const newChild = mapAst(orignalChild, cb);
        if (newChild !== orignalChild) {
          newAst = { ...newAst, [child.key]: newChild };
        }
      } else if (child.type === "ARRAY") {
        const orignalChildren = ast[child.key];
        const newChildren = orignalChildren.map(originalChild =>
          mapAst(originalChild, cb)
        );
        const childrenHaveChanged = orignalChildren.some(
          (child, i) => child !== newChildren[i]
        );
        if (childrenHaveChanged) {
          newAst = { ...newAst, [child.key]: newChildren };
        }
      }
    });
  } else {
    throw new Error(`Unknown children definitin for ${ast.type}`);
  }

  return cb(newAst);
}

module.exports = { mapAst };
