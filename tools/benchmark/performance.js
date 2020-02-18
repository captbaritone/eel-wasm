const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { splitPreset, createBasePresetFuns } = require("milkdrop-preset-utils");
const milkdropParser = require("milkdrop-eel-parser");

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

const baseValsDefaults = {
  decay: 0.98,
  gammaadj: 2,
  echo_zoom: 2,
  echo_alpha: 0,
  echo_orient: 0,
  red_blue: 0,
  brighten: 0,
  darken: 0,
  wrap: 1,
  darken_center: 0,
  solarize: 0,
  invert: 0,
  fshader: 0,
  b1n: 0,
  b2n: 0,
  b3n: 0,
  b1x: 1,
  b2x: 1,
  b3x: 1,
  b1ed: 0.25,
  wave_mode: 0,
  additivewave: 0,
  wave_dots: 0,
  wave_thick: 0,
  wave_a: 0.8,
  wave_scale: 1,
  wave_smoothing: 0.75,
  wave_mystery: 0,
  modwavealphabyvolume: 0,
  modwavealphastart: 0.75,
  modwavealphaend: 0.95,
  wave_r: 1,
  wave_g: 1,
  wave_b: 1,
  wave_x: 0.5,
  wave_y: 0.5,
  wave_brighten: 1,
  mv_x: 12,
  mv_y: 9,
  mv_dx: 0,
  mv_dy: 0,
  mv_l: 0.9,
  mv_r: 1,
  mv_g: 1,
  mv_b: 1,
  mv_a: 1,
  warpanimspeed: 1,
  warpscale: 1,
  zoomexp: 1,
  zoom: 1,
  rot: 0,
  cx: 0.5,
  cy: 0.5,
  dx: 0,
  dy: 0,
  warp: 1,
  sx: 1,
  sy: 1,
  ob_size: 0.01,
  ob_r: 0,
  ob_g: 0,
  ob_b: 0,
  ob_a: 0,
  ib_size: 0.01,
  ib_r: 0.25,
  ib_g: 0.25,
  ib_b: 0.25,
  ib_a: 0
};

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

  getVal(key) {
    return this.a[key];
  }
}

class WasmHarness {
  static async init(presetParts, optimize = false) {
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
      functions,
      optimize
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

  getVal(key) {
    return this.globals[key].value;
  }
}

class NoopHarness {
  constructor() {
    this.initEqs = () => {};
    this.frameEqs = () => {};
    this.pixelEqs = () => {};
    this.name = "Noop";
  }

  setVal(_key, _val) {}
  getVal(_key) {
    return 0;
  }
}

function perFrameVarsInit() {
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

  return perFrameVars;
}

const ITERATIONS = 1000;
function benchmarkHarness(harness, presetParts) {
  const perFrameVars = perFrameVarsInit();
  const mesh_width = perFrameVars.meshx;
  const mesh_height = perFrameVars.meshy;
  const aspectx = perFrameVars.aspectx;
  const aspecty = perFrameVars.aspecty;
  Object.entries(presetParts.baseVals).forEach(([key, val]) => {
    harness.setVal(key, val);
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

  return Math.round((ITERATIONS / duration) * 1000);
}

function readAndParsePreset(filePath) {
  const preset = fs.readFileSync(filePath, {
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
  presetParts.baseVals = Object.assign(
    {},
    baseValsDefaults,
    presetParts.baseVals
  );
  presetParts.baseVals.enabled = 1; // to avoid null checks

  return { presetParts, presetMap };
}

async function benchmarkMilk(filePath) {
  const { presetParts, presetMap } = readAndParsePreset(filePath);
  const jsHarness = new JsHarness(presetMap);
  const wasmHarness = await WasmHarness.init(presetParts);
  const wasmOptimizedHarness = await WasmHarness.init(presetParts, true);
  const noopHarness = new NoopHarness(presetParts);

  const jsIterationsPerSecond = benchmarkHarness(jsHarness, presetParts);
  const wasmIteationsPerSecond = benchmarkHarness(wasmHarness, presetParts);
  const wasmOptimizedIteationsPerSecond = benchmarkHarness(
    wasmOptimizedHarness,
    presetParts
  );
  const noopIteationsPerSecond = benchmarkHarness(noopHarness, presetParts);

  return {
    js: jsIterationsPerSecond,
    wasm: wasmIteationsPerSecond,
    wasmOptimized: wasmOptimizedIteationsPerSecond,
    noop: noopIteationsPerSecond
  };
}

const milkFiles = [
  "./fixtures/youtube_broadcast_yourself.milk",
  "./fixtures/Cope - Cartune (extrusion machine) [fixed].milk",
  "./fixtures/27_super_goats - neon country frequent flier program.milk",
  "./fixtures/bdrv_flexi_va_ultramix_148_oblivion_notifier.milk",
  "./fixtures/Flexi - piercing - pastel - 3d.milk"
];

async function perf() {
  const results = [];
  for (const milkFile of milkFiles) {
    const name = path.basename(milkFile);
    const result = await benchmarkMilk(milkFile);
    results.push({ name, ...result });
  }
  console.log(JSON.stringify(results, null, 2));
}

function getHarnessValues(harness, presetParts) {
  const values = {};
  Object.keys(presetParts.baseVals).forEach(key => {
    values[key] = harness.getVal(key);
  });

  return values;
}

const CONSISTENCY_ITERATIONS = 10;
function consistencyHarness(harness, presetParts) {
  const harnessValues = [];
  const perFrameVars = perFrameVarsInit();
  Object.entries(presetParts.baseVals).forEach(([key, val]) => {
    harness.setVal(key, val);
  });
  harnessValues.push(getHarnessValues(harness, presetParts));

  harness.initEqs();
  harnessValues.push(getHarnessValues(harness, presetParts));

  for (let i = 0; i < CONSISTENCY_ITERATIONS; i++) {
    Object.entries(perFrameVars).forEach(([key, val]) => {
      harness.setVal(key, val);
    });
    harness.frameEqs();

    harnessValues.push(getHarnessValues(harness, presetParts));

    perFrameVars.frame += 1;
    perFrameVars.time += 1 / perFrameVars.fps;
  }

  return harnessValues;
}

async function consistencyCheck() {
  const filePath = milkFiles[0];
  const { presetParts, presetMap } = readAndParsePreset(filePath);

  const jsHarness = new JsHarness(presetMap);
  const wasmHarness = await WasmHarness.init(presetParts);
  const wasmOptimizedHarness = await WasmHarness.init(presetParts, true);

  const jsHarnessValues = consistencyHarness(jsHarness, presetParts);
  const wasmHarnessValues = consistencyHarness(wasmHarness, presetParts);
  const wasmOptimizedHarnessValues = consistencyHarness(
    wasmOptimizedHarness,
    presetParts
  );

  let consistencyCheck = true;
  for (let i = 0; i <= CONSISTENCY_ITERATIONS; i++) {
    const harnessValues = {};
    Object.keys(presetParts.baseVals).forEach(key => {
      const js = jsHarnessValues[i][key];
      const wasm = wasmHarnessValues[i][key];
      const wasmOptimized = wasmOptimizedHarnessValues[i][key];
      harnessValues[key] = {
        js,
        wasm,
        wasmOptimized,
        "js === wasm": js === wasm,
        "wasm === wasmOptimized": wasm === wasmOptimized
      };
      consistencyCheck =
        consistencyCheck && js === wasm && wasm === wasmOptimized;
    });
    console.table(harnessValues);
  }
  console.log("CONSISTENCY CHECK: ", consistencyCheck);
}

var args = process.argv.slice(2);
if (args.length > 0 && args[0] === "consistency") {
  consistencyCheck();
} else {
  perf();
}
