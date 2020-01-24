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
      console.error(`Error in ${key} in ${path.basename(milkPath)}`);
      console.log(presetJson[key]);
      throw e;
    }
  });
}

const milkFiles = [
  "./fixtures/youtube_broadcast_yourself.milk",
  "./fixtures/bdrv_flexi_va_ultramix_148_oblivion_notifier.milk"
];

milkFiles.forEach(milk => {
  validate(milk);
});
