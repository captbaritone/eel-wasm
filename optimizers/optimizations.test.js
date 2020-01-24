const foldConstants = require("./constantFolding");
const propagateConstants = require("./constantPropagation");
const { parse } = require("../parser");

function runPass(ast) {
  return propagateConstants(foldConstants(ast));
}

test("Optimizaitions", () => {
  let ast = parse("a = 10; b = a + 10; c = b / 10;");
  let newAst = runPass(scriptAst);
  while (ast !== newAst) {
    ast = newAst;
    newAst = runPass(newAst);
  }
  expect(newAst).toMatchInlineSnapshot(`
    Object {
      "body": Object {
        "body": Array [
          Object {
            "column": 0,
            "expression": Object {
              "column": 0,
              "left": Object {
                "column": 0,
                "line": 1,
                "type": "IDENTIFIER",
                "value": "a",
              },
              "line": 1,
              "operator": "=",
              "right": Object {
                "column": 4,
                "line": 1,
                "type": "NUMBER_LITERAL",
                "value": 10,
              },
              "type": "ASSIGNMENT_EXPRESSION",
            },
            "line": 1,
            "type": "STATEMENT",
          },
          Object {
            "column": 8,
            "expression": Object {
              "column": 8,
              "left": Object {
                "column": 8,
                "line": 1,
                "type": "IDENTIFIER",
                "value": "b",
              },
              "line": 1,
              "operator": "=",
              "right": Object {
                "type": "NUMBER_LITERAL",
                "value": 20,
              },
              "type": "ASSIGNMENT_EXPRESSION",
            },
            "line": 1,
            "type": "STATEMENT",
          },
          Object {
            "column": 20,
            "expression": Object {
              "column": 20,
              "left": Object {
                "column": 20,
                "line": 1,
                "type": "IDENTIFIER",
                "value": "c",
              },
              "line": 1,
              "operator": "=",
              "right": Object {
                "type": "NUMBER_LITERAL",
                "value": 2,
              },
              "type": "ASSIGNMENT_EXPRESSION",
            },
            "line": 1,
            "type": "STATEMENT",
          },
        ],
        "column": 0,
        "line": 1,
        "type": "STATEMENT_BLOCK",
      },
      "column": 0,
      "line": 1,
      "type": "SCRIPT",
    }
  `);
});
