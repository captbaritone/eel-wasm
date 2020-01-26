const fs = require("fs");
const { performance } = require("perf_hooks");
const {
  splitPreset,
  createBasePresetFuns
} = require("../node_modules/milkdrop-preset-utils");
const milkdropParser = require("../node_modules/milkdrop-eel-parser");

const patch = require("./patchGlobal");
const MILKDROP_GLOBALS = require("../milkdropGlobals");
const { loadModule } = require("../evaluator");

patch(global);

function atan2(x, y) {
  let a = Math.atan2(x, y);
  if (a < 0) {
    a += 2 * Math.PI;
  }
  return a;
}

class JsHarness {
  constructor(json) {
    this.a = {};
    const initEqs = new Function("a", `${json.init_eqs_str} return a;`);
    const frameEqs = new Function("a", `${json.frame_eqs_str} return a;`);
    const pixelEqs = new Function("a", `${json.pixel_eqs_str} return a;`);
    this.initEqs = () => initEqs(this.a);
    this.frameEqs = () => frameEqs(this.a);
    this.pixelEqs = () => pixelEqs(this.a);
    this.name = "JavaScript";
  }

  setVal(key, val) {
    this.a[key] = val;
  }
}

class WasmHarness {
  static async init(presetParts) {
    const globals = {};
    MILKDROP_GLOBALS.forEach(name => {
      globals[name] = new WebAssembly.Global(
        { value: "f64", mutable: true },
        0
      );
    });

    const functions = {
      presetInit: presetParts.presetInit,
      perFrame: presetParts.perFrame,
      perPixel: presetParts.perVertex
    };

    const mod = await loadModule({
      globals,
      functions
    });

    return new WasmHarness(mod, globals);
  }

  constructor(mod, globals) {
    this.globals = globals;
    this.mod = mod;
    this.initEqs = () => mod.exports.presetInit();
    this.frameEqs = () => mod.exports.perFrame();
    this.pixelEqs = () => mod.exports.perPixel();
    this.name = "Wasm";
  }

  setVal(key, val) {
    this.globals[key].value = val;
  }
}

const ITERATIONS = 1000;
function benchmark(harness, presetParts) {
  // MilkDrop globals
  const texsizeX = 1200;
  const texsizeY = 800;
  const mesh_width = 48;
  const mesh_height = 36;
  const aspectx = texsizeY > texsizeX ? texsizeX / texsizeY : 1;
  const aspecty = texsizeX > texsizeY ? texsizeY / texsizeX : 1;
  const invAspectx = 1.0 / aspectx;
  const invAspecty = 1.0 / aspecty;

  const perFrameVars = {
    frame: 0,
    time: 0,
    fps: 60,
    bass: 1,
    bass_att: 1,
    mid: 1,
    mid_att: 1,
    treb: 1,
    treb_att: 1,
    meshx: mesh_width,
    meshy: mesh_height,
    aspectx: invAspectx,
    aspecty: invAspecty,
    pixelsx: texsizeX,
    pixelsy: texsizeY
  };

  Object.entries(presetParts.baseVals).forEach(([key, val]) => {
    if (val != null) {
      harness.setVal(key, val);
    }
  });
  const start = performance.now();
  harness.initEqs();
  for (let i = 0; i < ITERATIONS; i++) {
    Object.entries(perFrameVars).forEach(([key, val]) => {
      harness.setVal(key, val);
    });
    harness.frameEqs();

    const gridX = mesh_width + 1;
    const gridY = mesh_height + 1;
    for (let j = 0; j < gridX; j++) {
      const x = (j / gridX) * 2.0 - 1.0;
      for (let k = 0; k < gridY; k++) {
        const y = (k / gridY) * 2.0 - 1.0;
        const rad = Math.sqrt(
          x * x * aspectx * aspectx + y * y * aspecty * aspecty
        );
        let ang;
        if (k === gridY / 2 && j === gridX / 2) {
          ang = 0;
        } else {
          ang = atan2(y * aspecty, x * aspectx);
        }
        harness.setVal("x", x * 0.5 * aspectx + 0.5);
        harness.setVal("y", y * -0.5 * aspecty + 0.5);
        harness.setVal("rad", rad);
        harness.setVal("ang", ang);
        harness.pixelEqs();
      }
    }
    perFrameVars.frame += 1;
    perFrameVars.time += 1 / perFrameVars.fps;
  }

  const end = performance.now();
  const duration = end - start;

  const iterationsPerSecond = Math.round(
    (ITERATIONS / duration) * 1000
  ).toLocaleString();

  console.log(harness.name, iterationsPerSecond, "iterations / second");
}

async function main() {
  const preset = fs.readFileSync("./fixtures/youtube_broadcast_yourself.milk", {
    encoding: "utf8"
  });
  let mainPresetText = preset.split("[preset00]")[1];
  mainPresetText = mainPresetText.replace(/\r\n/g, "\n");
  const presetParts = splitPreset(mainPresetText);
  const parsedPreset = milkdropParser.convert_preset_wave_and_shape(
    presetParts.presetVersion,
    presetParts.presetInit,
    presetParts.perFrame,
    presetParts.perVertex,
    presetParts.shapes,
    presetParts.waves
  );
  let presetMap = createBasePresetFuns(
    parsedPreset,
    presetParts.shapes,
    presetParts.waves
  );
  const jsHarness = new JsHarness(presetMap);
  const wasmHarness = await WasmHarness.init(presetParts);

  benchmark(jsHarness, presetParts);
  benchmark(wasmHarness, presetParts);
}

main();
