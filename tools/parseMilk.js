#!/usr/bin/env node

/*
 * Utility script for trying the parser against EEL code extracted from
 * a collection of `.milk` files. Useful for validating that the parser
 * works (or doesn't) against real world code.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("../src/parser");
const { splitPreset } = require("milkdrop-preset-utils");
const countUssages = require("./countUssages");
const yargs = require("yargs");

const { argv } = yargs
  .option("summary", {
    type: "boolean",
    default: false,
    description: "Output a summary of all failures",
  })
  .option("first", {
    type: "number",
    description: "Number of presets to analyze",
  })
  .option("stats", {
    type: "boolean",
    description: "Output stats showing ussage of different syntax",
  })
  .option("file", {
    type: "string",
    description: "The file to parse",
  })
  .option("dir", {
    type: "string",
    description: "The directory to parse",
  })
  .help();

class Counter {
  constructor() {
    this._map = {};
  }

  add(name) {
    if (this._map[name] == null) {
      this._map[name] = 0;
    }

    this._map[name]++;
  }

  asObj() {
    return this._map;
  }
}

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

const BAD = new Set([
  "fixtures/mega/!Dawid.milk",
  "fixtures/mega/092j09jf09j09je09j9j09j09jef09j09je0f9j.milk",
  // Ends with a comment: x = // something
  "fixtures/mega/123456.milk",
  "fixtures/mega/123456remix1.milk",
  "fixtures/mega/123456remix2.milk",
  "fixtures/mega/123456remix3bom.milk",
  "fixtures/mega/123456remix3bomseila.milk",
  // Newline instead of semi
  "fixtures/mega/160.milk",
  "fixtures/mega/161.milk",
  "fixtures/mega/2009 4th of July with AdamFX n Martin - into the fireworks B.milk",
  "fixtures/mega/2009 4th of July with AdamFX n Martin - into the fireworks E.milk",
]);

function validate(milkPath, context) {
  if (BAD.has(milkPath)) {
    return;
  }
  const presetIni = fs.readFileSync(milkPath, { encoding: "utf8" });
  const eels = getEels(presetIni);

  Object.entries(eels).forEach(([name, eel]) => {
    try {
      const root = parse(eel);
      if (argv.stats) {
        countUssages(root, context);
      }
    } catch (e) {
      if (!argv.summary) {
        console.error(`\nError in ${name} in "${milkPath}"\n`);
        console.log(`\nnode tools/parseMilk.js --file="${milkPath}"\n`);
        console.log(eel);
      }
      throw e;
    }
  });
}

let milkFiles;
if (argv.dir) {
  const milkDir = argv.dir || path.join(__dirname, "../fixtures");
  files = fs.readdirSync(milkDir);
  milkFiles = files
    .filter(fileName => fileName.endsWith(".milk"))
    .map(fileName => {
      return path.join(milkDir, fileName);
    })
    .slice(0, argv.first);
} else if (argv.file) {
  milkFiles = [path.join(process.cwd(), argv.file)];
}

const context = {
  functions: new Counter(),
  binaryOperators: new Counter(),
  unaryOperators: new Counter(),
  assignmentOperators: new Counter(),
  logicalOperators: new Counter(),
  nodeTypes: new Counter(),
};

const errors = {};
let good = 0;
let bad = 0;
milkFiles.forEach(milk => {
  // console.log(`Validating eel in "${milk}"...`);
  try {
    validate(milk, context);
    good++;
  } catch (e) {
    if (!argv.summary) {
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
  if (argv.stats) {
    console.log({
      functions: context.functions.asObj(),
      binaryOperators: context.binaryOperators.asObj(),
      unaryOperators: context.unaryOperators.asObj(),
      logicalOperators: context.logicalOperators.asObj(),
      assignmentOperators: context.assignmentOperators.asObj(),
      nodeTypes: context.nodeTypes.asObj(),
    });
  }
  throw new Error("Errors found");
}
