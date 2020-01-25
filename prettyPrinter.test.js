const { parse } = require("./parser");
const { print } = require("./prettyPrinter");

function transform(code) {
  return print(parse(code));
}

const expressions = [
  "x = 5;",
  "x = if(1, 2, 3);",
  "x = 1 + 2;",
  "x = 10; y = 11;",
  "x = if(1, a = 10; y = 11;, 2);",
  "x = 1 ? 2 : 3;",
  "x = -1;",
];
expressions.forEach(expression => {
  test(`"${expression}" can be pretty printed`, () => {
    expect(transform(expression)).toBe(expression);
  });
});
