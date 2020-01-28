/*
 * Utility script for trying the parser against EEL code extracted from
 * a collection of `.milk` files. Useful for validating that the parser
 * works (or doesn't) against real world code.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("../src/parser");
const { splitPreset } = require("milkdrop-preset-utils");

// Turn this on to get a specific error report, not just an aggregate.
const FIND_ERROR = false;

const EEL_KEYS = ["presetInit", "perFrame", "perVertex"];
const SUB_EEL_KEYS = ["init_eqs_str", "frame_eqs_str", "point_eqs_str"];

// Hack an object out of a milk file that contains all it's eel code in the
// form: {[name]: eel}
function getEels(milk) {
  const presetJson = splitPreset(milk);
  const eels = {};
  EEL_KEYS.forEach(key => {
    if (presetJson[key]) {
      eels[key] = presetJson[key];
    }
  });
  presetJson.waves.forEach((wave, i) => {
    SUB_EEL_KEYS.forEach(key => {
      if (wave[key]) {
        eels[`wave${i}.${key}`] = wave[key];
      }
    });
  });
  presetJson.shapes.forEach((shape, i) => {
    SUB_EEL_KEYS.forEach(key => {
      if (shape[key]) {
        eels[`shape${i}.${key}`] = shape[key];
      }
    });
  });

  return eels;
}

function validate(milkPath) {
  const presetIni = fs.readFileSync(milkPath, { encoding: "utf8" });
  const eels = getEels(presetIni);

  Object.entries(eels).forEach(([name, eel]) => {
    try {
      parse(eel);
    } catch (e) {
      if (FIND_ERROR) {
        console.log(eel);
        console.error(`Error in ${name} in "${milkPath}"`);
      }
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

const errors = {};
let good = 0;
let bad = 0;
milkFiles.forEach(milk => {
  // console.log(`Validating eel in "${milk}"...`);
  try {
    validate(milk);
    good++;
  } catch (e) {
    if(FIND_ERROR) {
      throw new Error(e);
    }
    // console.error(e);
    const error = e.message.split("\n")[3];
    if (error in errors) {
      errors[error]++;
    } else {
      errors[error] = 1;
    }
    bad++;
  }
});

if (bad === 0) {
  console.log("No errors found!");
} else {
  console.log({ errors, good, bad });
  throw new Error("Errors found");
}
