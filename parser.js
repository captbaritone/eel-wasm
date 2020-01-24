const { Parser } = require("jison");

const binaryExpression =
  "$$ = {type: 'BINARY_EXPRESSION', left: $1, right: $3, operator: $2, column: @1.first_column, line: @1.first_line}";
const unaryExpression =
  "$$ = {type: 'UNARY_EXPRESSION', value: $2, operator: $1, column: @1.first_column, line: @1.first_line}";

const grammar = {
  comment: "EEL Parser",
  lex: {
    rules: [
      ["\\s+", "/* skip whitespace */"],
      ["//[^\n]*", "/* skip inline comments */"],
      ["[0-9]+", "return 'DIGIT'"],
      ["\\.", "return '.'"],
      ["[+\\-*/]?=", "return 'ASSIGNMENT_OPERATOR'"],
      ["\\*", "return '*'"],
      ["\\/", "return '/'"],
      ["-", "return '-'"],
      ["\\+", "return '+'"],
      [",", "return ','"],
      ["\\?", "return '?'"],
      ["\\:", "return ':'"],
      [";", "return ';'"],
      ["\\(", "return '('"],
      ["\\)", "return ')'"],
      // https://github.com/justinfrankel/WDL/blob/63943fbac273b847b733aceecdb16703679967b9/WDL/eel2/eel2.l#L93
      ["[a-zA-Z_][a-zA-Z0-9._]*", "return 'IDENTIFIER'"],
      ["$", "return 'EOF'"]
    ]
  },

  operators: [
    // List of operators ordered by precedence. First value is the operators
    // associativity. Operators of the same precedence should be on the same
    // line.
    // https://www.gnu.org/software/bison/manual/bison.html#Precedence
    ["right", "ASSIGNMENT_OPERATOR"],
    ["right", "?"],
    ["left", "+", "-"],
    ["left", "*", "/"]
    // TODO: Theoretically it should be possible to make `--1` a parse error.
  ],

  // TODO: These keys should be capitalized by convention.
  bnf: {
    // TODO: Are empty programs valid?
    script: [
      [
        "statementBlock EOF",
        "return {type: 'SCRIPT', body: $1, column: @1.first_column, line: @1.first_line}"
      ]
    ],
    // TODO: Are all expressions valid statements?
    statement: [
      [
        "e ;",
        "$$ = {type: 'STATEMENT', expression: $1, column: @1.first_column, line: @1.first_line}"
      ]
    ],
    statements: [
      ["statement", "$$ = [$1]"],
      ["statements statement", "$$ = $1.concat([$2])"]
    ],
    statementBlock: [
      [
        "statements",
        "$$ = {type: 'STATEMENT_BLOCK', body: $1, column: @1.first_column, line: @1.first_line}"
      ]
    ],
    identifier: [
      [
        "IDENTIFIER",
        "$$ = {type: 'IDENTIFIER', value: $1, column: @1.first_column, line: @1.first_line};"
      ]
    ],
    argument: ["e", "statementBlock"],
    arguments: [
      ["", "$$ = []"],
      ["argument", "$$ = [$1]"],
      ["arguments , argument", "$$ = $1.concat([$3])"]
    ],
    functionCall: [
      [
        "identifier ( arguments )",
        "$$ = {type: 'CALL_EXPRESSION', callee: $1, arguments: $3, column: @1.first_column, line: @1.first_line}"
      ]
    ],
    conditionalExpression: [
      [
        "e ? e : e",
        "$$ = {type: 'CONDITIONAL_EXPRESSION', test: $1, consiquent: $3, alternate: $5, column: @1.first_column, line: @1.first_line}"
      ]
    ],
    assignment: [
      [
        "identifier ASSIGNMENT_OPERATOR e",
        "$$ = {type: 'ASSIGNMENT_EXPRESSION', left: $1, operator: $2, right: $3, column: @1.first_column, line: @1.first_line}"
      ]
    ],
    number: [
      [
        "DIGIT",
        "$$ = {type: 'NUMBER_LITERAL', value: yytext, column: @1.first_column, line: @1.first_line}"
      ],
      [
        "DIGIT . DIGIT",
        "$$ = {type: 'NUMBER_LITERAL', value: Number($1 + $2 + $3), column: @1.first_column, line: @1.first_line}"
      ],
      [
        ". DIGIT",
        "$$ = {type: 'NUMBER_LITERAL', value: Number('0' + $1 + $2), column: @1.first_column, line: @1.first_line}"
      ]
    ],
    e: [
      ["e + e", binaryExpression],
      ["e - e", binaryExpression],
      ["e * e", binaryExpression],
      ["e / e", binaryExpression],
      ["- e", unaryExpression],
      ["+ e", unaryExpression],
      ["( e )", "$$ = $2"],
      "number",
      "assignment",
      "functionCall",
      "identifier",
      "conditionalExpression",
      ["( statementBlock )", "$$ = $2"]
    ]
  }
};

var parser = new Parser(grammar);

// generate source, ready to be written to disk
var parserSource = parser.generate();

// you can also use the parser directly from memory

module.exports = {
  parse: program => {
    return parser.parse(program);
  }
};
