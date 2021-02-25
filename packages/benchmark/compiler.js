const { compileModule, loadModule } = require("eel-wasm");
const { performance } = require("perf_hooks");
const presets = require("butterchurn-presets");

const Utils = {
  range(start, end) {
    if (end === undefined) {
      return [...Array(start).keys()];
    }

    return Array.from({ length: end - start }, (_, i) => i + start);
  },
};

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
  bmotionvectorson: 1,
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
  ib_a: 0,
};

const shapeBaseValsDefaults = {
  enabled: 0,
  sides: 4,
  additive: 0,
  thickoutline: 0,
  textured: 0,
  num_inst: 1,
  tex_zoom: 1,
  tex_ang: 0,
  x: 0.5,
  y: 0.5,
  rad: 0.1,
  ang: 0,
  r: 1,
  g: 0,
  b: 0,
  a: 1,
  r2: 0,
  g2: 1,
  b2: 0,
  a2: 0,
  border_r: 1,
  border_g: 1,
  border_b: 1,
  border_a: 0.1,
};

const waveBaseValsDefaults = {
  enabled: 0,
  samples: 512,
  sep: 0,
  scaling: 1,
  smoothing: 0.5,
  r: 1,
  g: 1,
  b: 1,
  a: 1,
  spectrum: 0,
  usedots: 0,
  thick: 0,
  additive: 0,
};

const qs = Utils.range(1, 33).map(x => `q${x}`);
const ts = Utils.range(1, 9).map(x => `t${x}`);

const globalPerFrameVars = [
  "old_wave_mode",
  // globals
  "frame",
  "time",
  "fps",
  "bass",
  "bass_att",
  "mid",
  "mid_att",
  "treb",
  "treb_att",
  "meshx",
  "meshy",
  "aspectx",
  "aspecty",
  "pixelsx",
  "pixelsy",
  "rand_start",
  "rand_preset",
];

const globalPerPixelVars = [
  // globals
  "frame",
  "time",
  "fps",
  "bass",
  "bass_att",
  "mid",
  "mid_att",
  "treb",
  "treb_att",
  "meshx",
  "meshy",
  "aspectx",
  "aspecty",
  "pixelsx",
  "pixelsy",
  "rand_start",
  "rand_preset",
  // for pixel eqs
  "x",
  "y",
  "rad",
  "ang",
];

const globalShapeVars = [
  // globals
  "frame",
  "time",
  "fps",
  "bass",
  "bass_att",
  "mid",
  "mid_att",
  "treb",
  "treb_att",
  "meshx",
  "meshy",
  "aspectx",
  "aspecty",
  "pixelsx",
  "pixelsy",
  "rand_start",
  "rand_preset",
  // for shape eqs
  "instance",
];

const shapeBaseVars = [
  "x",
  "y",
  "rad",
  "ang",
  "r",
  "g",
  "b",
  "a",
  "r2",
  "g2",
  "b2",
  "a2",
  "border_r",
  "border_g",
  "border_b",
  "border_a",
  "thickoutline",
  "textured",
  "tex_zoom",
  "tex_ang",
  "additive",
];

const globalWaveVars = [
  // globals
  "frame",
  "time",
  "fps",
  "bass",
  "bass_att",
  "mid",
  "mid_att",
  "treb",
  "treb_att",
  "meshx",
  "meshy",
  "aspectx",
  "aspecty",
  "pixelsx",
  "pixelsy",
  "rand_start",
  "rand_preset",
  // for wave eqs
  "x",
  "y",
  "sample",
  "value1",
  "value2",
];

function createQVars() {
  const wasmVars = {};

  qs.forEach(key => {
    wasmVars[key] = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  });

  return wasmVars;
}

function createTVars() {
  const wasmVars = {};

  ts.forEach(key => {
    wasmVars[key] = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  });

  return wasmVars;
}

function createPerFramePool(baseVals) {
  const wasmVars = {};

  Object.keys(baseValsDefaults).forEach(key => {
    wasmVars[key] = new WebAssembly.Global(
      { value: "f64", mutable: true },
      baseVals[key]
    );
  });

  globalPerFrameVars.forEach(key => {
    wasmVars[key] = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  });

  return wasmVars;
}

function createPerPixelPool(baseVals) {
  const wasmVars = {};

  Object.keys(baseValsDefaults).forEach(key => {
    wasmVars[key] = new WebAssembly.Global(
      { value: "f64", mutable: true },
      baseVals[key]
    );
  });

  globalPerPixelVars.forEach(key => {
    wasmVars[key] = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  });

  return wasmVars;
}

function createCustomShapePerFramePool(baseVals) {
  const wasmVars = {};

  Object.keys(shapeBaseValsDefaults).forEach(key => {
    wasmVars[key] = new WebAssembly.Global(
      { value: "f64", mutable: true },
      baseVals[key]
    );
  });

  globalShapeVars.forEach(key => {
    wasmVars[key] = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  });

  return wasmVars;
}

function createCustomWavePerFramePool(baseVals) {
  const wasmVars = {};

  Object.keys(waveBaseValsDefaults).forEach(key => {
    wasmVars[key] = new WebAssembly.Global(
      { value: "f64", mutable: true },
      baseVals[key]
    );
  });

  globalWaveVars.forEach(key => {
    wasmVars[key] = new WebAssembly.Global({ value: "f64", mutable: true }, 0);
  });

  return wasmVars;
}

function loadWASMPreset(preset, blendTime) {
  const qWasmVars = createQVars();
  const tWasmVars = createTVars();

  const wasmVarPools = {
    perFrame: { ...qWasmVars, ...createPerFramePool(preset.baseVals) },
    perVertex: {
      ...qWasmVars,
      ...createPerPixelPool(preset.baseVals),
    },
  };

  const wasmFunctions = {
    presetInit: { pool: "perFrame", code: preset.init_eqs_eel },
    perFrame: { pool: "perFrame", code: preset.frame_eqs_eel },
  };

  if (preset.pixel_eqs_eel !== "") {
    wasmFunctions.perPixel = {
      pool: "perVertex",
      code: preset.pixel_eqs_eel,
    };
  }

  for (let i = 0; i < preset.shapes.length; i++) {
    wasmVarPools[`shapePerFrame${i}`] = {
      ...qWasmVars,
      ...tWasmVars,
      ...createCustomShapePerFramePool(preset.shapes[i].baseVals),
    };

    if (preset.shapes[i].baseVals.enabled !== 0) {
      wasmFunctions[`shapes_${i}_init_eqs`] = {
        pool: `shapePerFrame${i}`,
        code: preset.shapes[i].init_eqs_eel,
      };
      wasmFunctions[`shapes_${i}_frame_eqs`] = {
        pool: `shapePerFrame${i}`,
        code: preset.shapes[i].frame_eqs_eel,
      };
    }
  }

  for (let i = 0; i < preset.waves.length; i++) {
    if (preset.waves[i].baseVals.enabled !== 0) {
      wasmVarPools[`wavePerFrame${i}`] = {
        ...qWasmVars,
        ...tWasmVars,
        ...createCustomWavePerFramePool(preset.waves[i].baseVals),
      };
      wasmFunctions[`waves_${i}_init_eqs`] = {
        pool: `wavePerFrame${i}`,
        code: preset.waves[i].init_eqs_eel,
      };
      wasmFunctions[`waves_${i}_frame_eqs`] = {
        pool: `wavePerFrame${i}`,
        code: preset.waves[i].frame_eqs_eel,
      };

      if (
        preset.waves[i].point_eqs_eel &&
        preset.waves[i].point_eqs_eel !== ""
      ) {
        wasmFunctions[`waves_${i}_point_eqs`] = {
          pool: `wavePerFrame${i}`,
          code: preset.waves[i].point_eqs_eel,
        };
      }
    }
  }

  let compilerPools = {};
  Object.entries(wasmVarPools).forEach(([key, globals]) => {
    compilerPools[key] = new Set(Object.keys(globals));
  });
  return {
    pools: compilerPools,
    functions: wasmFunctions,
    eelVersion: preset.version || 2,
  };
}

function main() {
  const index = process.argv[2];
  const presetName = Object.keys(presets.default)[index];
  const preset = presets.default[presetName];
  if (preset == null) {
    throw new Error(`Unknown preset "${process.argv[2]}"`);
  }
  const config = loadWASMPreset(preset);
  const start = performance.now();
  const mod = compileModule(config);
  const end = performance.now();
  console.log(end - start);
}

main();
