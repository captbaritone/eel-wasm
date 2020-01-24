/*
 * Utility script for trying the parser against EEL code extracted from
 * a collection of `.milk` files. Useful for validating that the parser
 * works (or doesn't) against real world code.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("../parser");
const { splitPreset } = require("milkdrop-preset-utils");

const EEL_KEYS = ["presetInit", "perFrame", "perVertex"];

function validate(milkPath) {
  const presetIni = fs.readFileSync(milkPath, { encoding: "utf8" });
  const presetJson = splitPreset(presetIni);

  EEL_KEYS.forEach(key => {
    const eel = presetJson[key];
    if (!eel) {
      return;
    }
    try {
      parse(presetJson[key]);
    } catch (e) {
      console.log(presetJson[key]);
      console.error(`Error in ${key} in ${path.basename(milkPath)}`);
      throw e;
    }
  });
}


const pathArg = process.argv[2];
const milkDir = pathArg || path.join(__dirname, "../fixtures");
const files = fs.readdirSync(milkDir);
const milkFiles = files
  .filter(fileName => fileName.endsWith(".milk"))
  .map(fileName => {
    return path.join(milkDir, fileName);
  });

milkFiles.forEach(milk => {
  console.log(`Validating eel in "${path.relative(process.cwd(), milk)}"...`)
  validate(milk);
});
console.log("No errors found!");
