const { Parser } = require("jison");

const binaryExpression =
  "$$ = {type: 'BINARY_EXPRESSION', left: $1, right: $3, operator: $2}";
const unaryExpression =
  "$$ = {type: 'UNARY_EXPRESSION', value: $2, operator: $1}";
const numberLiteral = "$$ = {type: 'NUMBER_LITERAL', value: yytext}";

const grammar = {
  comment: "EEL Parser",
  lex: {
    rules: [
      ["\\s+", "/* skip whitespace */"],
      ["[0-9]+(?:\\.[0-9]+)?\\b", "return 'NUMBER'"],
      ["\\*", "return '*'"],
      ["\\/", "return '/'"],
      ["-", "return '-'"],
      ["\\+", "return '+'"],
      [",", "return ','"],
      // ["\\^", "return '^'"],
      // ["!", "return '!'"],
      // ["%", "return '%'"],
      ["\\(", "return '('"],
      ["\\)", "return ')'"],
      // ["PI\\b", "return 'PI'"],
      // ["E\\b", "return 'E'"],
      ["[a-z]+", "return 'IDENTIFIER'"],
      ["$", "return 'EOF'"]
    ]
  },

  operators: [
    ["left", "+", "-"],
    ["left", "*", "/"],
    // ["left", "^"],
    // ["right", "!"],
    // ["right", "%"],
    ["left", "UMINUS"][("left", "UPLUS")]
  ],

  bnf: {
    expressions: [["e EOF", "return $1"]],
    identifier: [["IDENTIFIER", "$$ = {type: 'IDENTIFIER', value: $1}"]],
    arguments: [
      // TODO: Support arbitrary arguments
      ["e", "$$ = [$1]"],
      ["e , e", "$$ = [$1, $3]"]
    ],
    functionCall: [
      [
        "identifier ( arguments )",
        "$$ = {type: 'CALL_EXPRESSION', callee: $1, arguments: $3}"
      ]
    ],
    e: [
      ["e + e", binaryExpression],
      ["e - e", binaryExpression],
      ["e * e", binaryExpression],
      ["e / e", binaryExpression],
      // ["e ^ e", binaryExpression],
      // [ "e !", "$$ = (function(n) {if(n==0) return 1; return arguments.callee(n-1) * n})($1)" ],
      // ["e %", "$$ = $1/100"],
      ["- e", unaryExpression, { prec: "UMINUS" }],
      ["+ e", unaryExpression, { prec: "UPLUS" }],
      ["( e )", "$$ = $2"],
      ["NUMBER", numberLiteral],
      ["functionCall", "$$ = $1"]
      // ["E", "$$ = Math.E"],
      // ["PI", "$$ = Math.PI"]
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
