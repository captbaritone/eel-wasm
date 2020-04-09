const { parse } = require("../src/parser");
const { print } = require("./prettyPrinter");

function transform(code) {
  return print(parse(code));
}

function joinLines(str) {
  return str.replace("\n", " ");
}

const expressions = [
  "x = 5;",
  "x = if(1, 2, 3);",
  "x = 1 + 2;",
  "x = 10; y = 11;",
  "x = if(1, a = 10; y = 11;, 2);",
  "x = -1;",
  "x = if(5, 6, 7);",
  "x = exec2(5, 6);",
  "x = exec3(5, 6, 7);",
];
expressions.forEach(expression => {
  test(`"${expression}" can be pretty printed`, () => {
    expect(joinLines(transform(expression))).toBe(expression);
  });
});
