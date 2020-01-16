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
      // ["\\*", "return '*'"],
      // ["\\/", "return '/'"],
      ["-", "return '-'"],
      ["\\+", "return '+'"],
      // ["\\^", "return '^'"],
      // ["!", "return '!'"],
      // ["%", "return '%'"],
      ["\\(", "return '('"],
      ["\\)", "return ')'"],
      // ["PI\\b", "return 'PI'"],
      // ["E\\b", "return 'E'"],
      ["$", "return 'EOF'"]
    ]
  },

  operators: [
    ["left", "+", "-"],
    // ["left", "*", "/"],
    // ["left", "^"],
    // ["right", "!"],
    // ["right", "%"],
    ["left", "UMINUS"]
  ],

  bnf: {
    expressions: [["e EOF", "return $1"]],
    e: [
      ["e + e", binaryExpression],
      ["e - e", binaryExpression],
      // ["e * e", binaryExpression],
      // ["e / e", binaryExpression],
      // ["e ^ e", binaryExpression],
      // [ "e !", "$$ = (function(n) {if(n==0) return 1; return arguments.callee(n-1) * n})($1)" ],
      // ["e %", "$$ = $1/100"],
      ["- e", unaryExpression, { prec: "UMINUS" }],
      ["( e )", "$$ = $2"],
      ["NUMBER", numberLiteral],
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
