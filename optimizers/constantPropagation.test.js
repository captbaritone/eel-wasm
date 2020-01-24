const propagateConstants = require("./constantPropagation");
const { parse } = require("../parser");

test("Constant Folding", () => {
  const scriptAst = parse("a = 10; g = a;");
  const optimized = propagateConstants(scriptAst);
  expect(optimized).toMatchInlineSnapshot(`
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
                "value": "g",
              },
              "line": 1,
              "operator": "=",
              "right": Object {
                "type": "NUMBER_LITERAL",
                "value": 10,
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
