const CHILDREN = {
  MODULE: [{ type: "ARRAY", key: "exportedFunctions" }],
  FUNCTION_EXPORT: [{ type: "NODE", key: "function" }],
  ASSIGNMENT_EXPRESSION: [
    { type: "NODE", key: "right" },
    // `left` is a child node, but IDENTIFER is not emitted in the same way, so
    // we skip here.
    /* { type: "NODE", key: "left" },*/
  ],
  SCRIPT: [{ type: "ARRAY", key: "body" }],
  EXPRESSION_BLOCK: [{ type: "ARRAY", key: "body" }],
  UNARY_EXPRESSION: [{ type: "NODE", key: "value" }],
  NUMBER_LITERAL: [],
  IDENTIFIER: [],
  CALL_EXPRESSION: [
    { type: "ARRAY", key: "arguments" },
    // `callee` is a child node, but IDENTIFER is not emitted in the same way, so
    // we skip here.
    /* {type: "NODE", key: "callee"}*/
  ],
  BINARY_EXPRESSION: [
    { type: "NODE", key: "left" },
    { type: "NODE", key: "right" },
  ],
  LOGICAL_EXPRESSION: [
    { type: "NODE", key: "left" },
    { type: "NODE", key: "right" },
  ],
};

function mapAst(ast, cb) {
  const children = CHILDREN[ast.type];
  let newAst = ast;
  if (children == null) {
    throw new Error(`Unknown children definition for ${ast.type}`);
  }
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

  return cb(newAst);
}

module.exports = { mapAst };
