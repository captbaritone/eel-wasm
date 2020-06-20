import fs from "fs";
import path from "path";
import { compileModule } from "../compiler";
import { printLoc } from "../errorUtils";

const DIR = path.join(__dirname, "../../fixtures/errors");

const testCases = fs.readdirSync(DIR);

testCases.forEach((filename: string) => {
  const testFunc = filename.startsWith("only.") ? test.only : test;
  const testName = filename.replace(/^only\./, "");
  testFunc(`${testName}`, () => {
    const eel = fs.readFileSync(path.join(DIR, filename), { encoding: "utf8" });
    let compilerError = null;
    try {
      compileModule({
        pools: { main: { globals: new Set(), functions: { run: eel } } },
      });
    } catch (e) {
      compilerError = e;
    }

    // TODO: Assert that error is a user or compiler error
    expect(compilerError).not.toBe(null);

    expect(compilerError.message).toMatchSnapshot();
    // We prepend a newline here so that the error starts on a newline rather
    // than a '"' in the snapshot and our underline alinment is easy to see.
    expect("\n" + compilerError.sourceContext).toMatchSnapshot();
  });
});

describe("printLoc", () => {
  test("One line", () => {
    const frame = printLoc(
      { first_line: 1, first_column: 6, last_line: 1, last_column: 11 },
      "Hello there this is a string"
    );
    expect("\n" + frame + "\n").toMatchInlineSnapshot(`
      "
      > 1 | Hello there this is a string
          |       ^^^^^
      "
    `);
  });
  test("One line within multiple lines", () => {
    const frame = printLoc(
      { first_line: 4, first_column: 6, last_line: 4, last_column: 11 },
      [
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
      ].join("\n")
    );
    expect("\n" + frame + "\n").toMatchInlineSnapshot(`
      "
        3 | Hello there this is a string
      > 4 | Hello there this is a string
          |       ^^^^^
        5 | Hello there this is a string
      "
    `);
  });
  test("One line within multiple lines + 2 lines of context", () => {
    const frame = printLoc(
      { first_line: 4, first_column: 6, last_line: 4, last_column: 11 },
      [
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
      ].join("\n"),
      2
    );
    expect("\n" + frame + "\n").toMatchInlineSnapshot(`
      "
        2 | Hello there this is a string
        3 | Hello there this is a string
      > 4 | Hello there this is a string
          |       ^^^^^
        5 | Hello there this is a string
        6 | Hello there this is a string
      "
    `);
  });
  test("Multiple lines", () => {
    const frame = printLoc(
      { first_line: 1, first_column: 6, last_line: 2, last_column: 11 },
      "Hello there this is a string\nHello there this is a string"
    );
    expect("\n" + frame + "\n").toMatchInlineSnapshot(`
      "
      > 1 | Hello there this is a string
      > 2 | Hello there this is a string
      "
    `);
  });

  test("Multiple lines within multiple lines", () => {
    const frame = printLoc(
      { first_line: 3, first_column: 6, last_line: 5, last_column: 11 },
      [
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
        "Hello there this is a string",
      ].join("\n")
    );
    expect("\n" + frame + "\n").toMatchInlineSnapshot(`
      "
        2 | Hello there this is a string
      > 3 | Hello there this is a string
      > 4 | Hello there this is a string
      > 5 | Hello there this is a string
        6 | Hello there this is a string
      "
    `);
  });
});
