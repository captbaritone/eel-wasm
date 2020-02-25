const { preProcess } = require("./preProcessor");

describe("Newlines", () => {
  test("basic", () => {
    const actual = preProcess("No\r\n new \r\nline.");
    const expected = "No new line.";
    expect(actual).toBe(expected);
  });
  test("within token", () => {
    const actual = preProcess("55\r\n55");
    const expected = "5555";
    expect(actual).toBe(expected);
  });
});

describe("Comments", () => {
  test("regular", () => {
    const actual = preProcess("No // Comment.");
    const expected = "No ";
    expect(actual).toBe(expected);
  });

  test("backwards", () => {
    const actual = preProcess("No \\\\ Comment.");
    const expected = "No ";
    expect(actual).toBe(expected);
  });
  test("with newline", () => {
    const actual = preProcess("No // freaking\r\nway.");
    const expected = "No way.";
    expect(actual).toBe(expected);
  });
});
