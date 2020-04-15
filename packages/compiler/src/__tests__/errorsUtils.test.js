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
    const compile = () => {
      compileModule({ globals: new Set(), functions: { run: eel }, shims });
    };

    expect(compile).toThrowErrorMatchingSnapshot();
  });
});
