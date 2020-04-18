import { preProcess, getLoc } from "../preProcessor";

describe("getLoc", () => {
  test("basic", () => {
    expect(getLoc([], 10)).toEqual({ line: 1, column: 10 });
  });
  test("after first anchor", () => {
    expect(getLoc([{ destCol: 5, srcCol: 5, srcLine: 5 }], 10)).toEqual({
      line: 5,
      column: 10,
    });
  });
  test("before first anchor", () => {
    expect(getLoc([{ destCol: 5, srcCol: 5, srcLine: 5 }], 3)).toEqual({
      line: 1,
      column: 3,
    });
  });
  test("between two anchors", () => {
    expect(
      getLoc(
        [
          { destCol: 5, srcCol: 5, srcLine: 5 },
          { destCol: 10, srcCol: 10, srcLine: 10 },
        ],
        8
      )
    ).toEqual({
      line: 5,
      column: 8,
    });
  });
});

describe("Windows Newlines", () => {
  test("basic", () => {
    const [actual] = preProcess("No\r\n new \r\nline.");
    const expected = "No new line.";
    expect(actual).toBe(expected);
  });
  test("within token", () => {
    const [actual] = preProcess("55\r\n55");
    const expected = "5555";
    expect(actual).toBe(expected);
  });
});

describe("Newlines", () => {
  test("basic", () => {
    const [actual] = preProcess("No\n new \nline.");
    const expected = "No new line.";
    expect(actual).toBe(expected);
  });
  test("within token", () => {
    const [actual] = preProcess("55\n55");
    const expected = "5555";
    expect(actual).toBe(expected);
  });
});

describe("Comments", () => {
  test("regular", () => {
    const [actual] = preProcess("No // Comment.");
    const expected = "No ";
    expect(actual).toBe(expected);
  });

  test("backwards", () => {
    const [actual] = preProcess("No \\\\ Comment.");
    const expected = "No ";
    expect(actual).toBe(expected);
  });
  test("with newline", () => {
    const [actual] = preProcess("No // freaking\r\nway.");
    const expected = "No way.";
    expect(actual).toBe(expected);
  });
  test("multiline", () => {
    const [actual] = preProcess("No /* freaking\r\n fracking\r\n */way.");
    const expected = "No way.";
    expect(actual).toBe(expected);
  });
  test("unbalanced multiline", () => {
    const [actual] = preProcess("*/ I actually want this.");
    const expected = "*/ I actually want this.";
    expect(actual).toBe(expected);
  });
});

test("getLoc", () => {
  const point = getLoc([{ destCol: 1, srcCol: 1, srcLine: 10 }], 5);
  expect(point).toEqual({ line: 10, column: 5 });
});

test("basic", () => {
  const [out, mapper] = preProcess("No\r\n new \r\nline.");
  const expected = "No new line.";
  expect(out).toBe(expected);

  expect(getLoc(mapper, 1)).toEqual({
    line: 1,
    column: 1,
  });
  expect(getLoc(mapper, 3)).toEqual({
    line: 2,
    column: 1,
  });
});

test("Consecutive newlines", () => {
  const [out, mapper] = preProcess("No\r\n\r\n new \r\nline.");
  expect(mapper).toEqual([
    { destCol: 3, srcCol: 1, srcLine: 2 },
    { destCol: 3, srcCol: 1, srcLine: 3 },
    { destCol: 8, srcCol: 1, srcLine: 4 },
  ]);
  const expected = "No new line.";
  expect(out).toBe(expected);

  expect(getLoc(mapper, 3)).toEqual({
    line: 3,
    column: 1,
  });
});

test("Block comment", () => {
  const [out, mapper] = preProcess("Nothing/* lol */ to see here");
  // expect(mapper).toEqual([{ destCol: 8, srcCol: 17, srcLine: 1 }]);
  const expected = "Nothing to see here";
  expect(out).toBe(expected);

  expect(getLoc(mapper, 7)).toEqual({
    line: 1,
    column: 7,
  });
  expect(getLoc(mapper, 9)).toEqual({
    line: 1,
    column: 18,
  });
});

test("Block comment second line", () => {
  const [out, mapper] = preProcess("No\r\nthing/* lol */ to see here");
  expect(mapper).toEqual([
    { destCol: 3, srcCol: 1, srcLine: 2 },
    { destCol: 8, srcCol: 15, srcLine: 2 },
  ]);
  const expected = "Nothing to see here";
  expect(out).toBe(expected);

  expect(getLoc(mapper, 7)).toEqual({
    line: 2,
    column: 5,
  });

  expect(getLoc(mapper, 9)).toEqual({
    line: 2,
    column: 16,
  });
});
