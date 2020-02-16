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
      ["[0-9]+", "return 'DIGITS_TOKEN'"],
      ["(==|<=|>=|<|>)", "return 'COMPARISON_TOKEN'"],
      ["[+\\-*/%]?=", "return 'ASSIGNMENT_OPERATOR_TOKEN'"],
      ["(\\&\\&)|\\|\\|", "return 'LOGICAL_OPERATOR_TOKEN'"],
      // https://github.com/justinfrankel/WDL/blob/63943fbac273b847b733aceecdb16703679967b9/WDL/eel2/eel2.l#L93
      ["[a-zA-Z_][a-zA-Z0-9._]*", "return 'IDENTIFIER_TOKEN'"],
      ["$", "return 'EOF'"],
      [".", "return yytext[0]"],
    ],
  },

  operators: [
    // List of operators ordered by precedence. First value is the operators
    // associativity. Operators of the same precedence should be on the same
    // line.
    // https://www.gnu.org/software/bison/manual/bison.html#Precedence
    // TODO: Confirm these orders
    ["right", "ASSIGNMENT_OPERATOR_TOKEN"],
    ["right", "?"],
    ["right", "COMPARISON_TOKEN"],
    ["left", "+", "-"],
    ["left", "*", "/", "%"],
    ["left", "&", "|" /* "~"" will go here as well */],
    ["left", "LOGICAL_OPERATOR_TOKEN"],
    // TODO: Theoretically it should be possible to make `--1` a parse error.
  ],

  bnf: {
    // TODO: Are empty programs valid?
    SCRIPT: [
      [
        "expressionsOptionalTrailingSemi EOF",
        "return {type: 'SCRIPT', body: $1, column: @1.first_column, line: @1.first_line}",
      ],
      [
        "EOF",
        "return {type: 'SCRIPT', body: [], column: @1.first_column, line: @1.first_line}",
      ],
    ],
    expressions: [
      ["expression ;", "$$ = [$1]"],
      ["expressions expression ;", "$$ = $1.concat([$2])"],
    ],
    // This feels like a hack, but I haven't managed to find another way to
    // express optional semicolons while still keeping the grammar unambiguous.
    // Notably this does not allow single expressions to omit the trailing semi.
    expressionsOptionalTrailingSemi: [
      ["expressions", "$$ = $1"],
      ["expressions expression", "$$ = $1.concat([$2])"],
    ],
    EXPRESSION_BLOCK: [
      [
        "expressionsOptionalTrailingSemi",
        "$$ = {type: 'EXPRESSION_BLOCK', body: $1, column: @1.first_column, line: @1.first_line}",
      ],
    ],
    IDENTIFIER: [
      [
        "IDENTIFIER_TOKEN",
        "$$ = {type: 'IDENTIFIER', value: $1, column: @1.first_column, line: @1.first_line};",
      ],
    ],
    argument: ["expression", "EXPRESSION_BLOCK"],
    arguments: [
      ["argument", "$$ = [$1]"],
      ["arguments , argument", "$$ = $1.concat([$3])"],
    ],
    FUNCTION_CALL: [
      [
        "IDENTIFIER ( )",
        "$$ = {type: 'CALL_EXPRESSION', callee: $1, arguments: [], column: @1.first_column, line: @1.first_line}",
      ],
      [
        "IDENTIFIER ( arguments )",
        "$$ = {type: 'CALL_EXPRESSION', callee: $1, arguments: $3, column: @1.first_column, line: @1.first_line}",
      ],
    ],
    CONDITIONAL_EXPRESSION: [
      [
        "expression ? expression : expression",
        "$$ = {type: 'CONDITIONAL_EXPRESSION', test: $1, consiquent: $3, alternate: $5, column: @1.first_column, line: @1.first_line}",
      ],
    ],
    LOGICAL_EXPRESSION: [
      [
        "expression LOGICAL_OPERATOR_TOKEN expression",
        "$$ = {type: 'LOGICAL_EXPRESSION', left: $1, right: $3, operator: $2, column: @1.first_column, line: @1.first_line}",
      ],
    ],
    ASSIGNMENT: [
      [
        "IDENTIFIER ASSIGNMENT_OPERATOR_TOKEN expression",
        "$$ = {type: 'ASSIGNMENT_EXPRESSION', left: $1, operator: $2, right: $3, column: @1.first_column, line: @1.first_line}",
      ],
    ],
    number: [
      ["DIGITS_TOKEN", "$$ = Number($1)"],
      ["DIGITS_TOKEN . DIGITS_TOKEN", "$$ = Number($1 + $2 + $3)"],
      [". DIGITS_TOKEN", "$$ = Number('0' + $1 + $2)"],
    ],
    NUMBER_LITERAL: [
      [
        "number",
        "$$ = {type: 'NUMBER_LITERAL', value: $1, column: @1.first_column, line: @1.first_line}",
      ],
    ],
    UNARY_EXPRESSION: [
      ["- expression", unaryExpression],
      ["+ expression", unaryExpression],
    ],
    BINARY_EXPRESSION: [
      ["expression + expression", binaryExpression],
      ["expression - expression", binaryExpression],
      ["expression * expression", binaryExpression],
      ["expression / expression", binaryExpression],
      ["expression % expression", binaryExpression],
      ["expression & expression", binaryExpression],
      ["expression | expression", binaryExpression],
      ["expression COMPARISON_TOKEN expression", binaryExpression],
    ],
    expression: [
      "BINARY_EXPRESSION",
      "UNARY_EXPRESSION",
      ["( expression )", "$$ = $2"],
      "NUMBER_LITERAL",
      "ASSIGNMENT",
      "FUNCTION_CALL",
      "IDENTIFIER",
      "CONDITIONAL_EXPRESSION",
      "LOGICAL_EXPRESSION",
      ["( EXPRESSION_BLOCK )", "$$ = $2"],
    ],
  },
};

var parser = new Parser(grammar);

// If called from CLI, we should output source.
if (require.main === module) {
  const settings = { moduleType: "commonjs" };
  console.log(parser.generate(settings));
}

// you can also use the parser directly from memory

module.exports = {
  parse: program => {
    return parser.parse(program);
  },
};
