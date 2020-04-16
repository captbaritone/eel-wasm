const fs = require("fs");
const path = require("path");
const { compileModule } = require("../compiler");
const shims = require("../shims");

const DIR = path.join(__dirname, "../../fixtures/errors");

const testCases = fs.readdirSync(DIR);

testCases.forEach(filename => {
  const testFunc = filename.startsWith("only.") ? test.only : test;
  const testName = filename.replace(/^only\./, "");
  testFunc(`${testName}`, () => {
    const eel = fs.readFileSync(path.join(DIR, filename), { encoding: "utf8" });
    let compilerError = null;
    try {
      compileModule({ globals: new Set(), functions: { run: eel }, shims });
    } catch (e) {
      compilerError = e;
    }

    expect(compilerError).not.toBe(null);

    expect(compilerError.message).toMatchSnapshot();
    // We prepend a newline here so that the error starts on a newline rather
    // than a '"' in the snapshot and our underline alinment is easy to see.
    expect("\n" + compilerError.sourceContext).toMatchSnapshot();
  });
});
