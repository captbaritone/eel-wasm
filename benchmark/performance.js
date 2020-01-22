const fs = require("fs");
const { performance } = require("perf_hooks");

const presetJson = require("../fixtures/md_youtube_broadcast_yourself.json");
const patch = require("./patchGlobal");
const MILKDROP_GLOBALS = require("../milkdropGlobals");
const { loadModule } = require("../evaluator");

patch(global);

class JsHarness {
  constructor(json) {
    this.a = {};
    // this.initEqs = new Function("a", `${json.init_eqs_str} return a;`);
    const frameEqs = new Function("a", `${json.frame_eqs_str} return a;`);
    const pixelEqs = new Function("a", `${json.pixel_eqs_str} return a;`);
    this.initEqs = () => {};
    this.frameEqs = () => frameEqs(this.a);
    this.pixelEqs = () => pixelEqs(this.a);
    this.name = "JavaScript";
  }

  setVal(key, val) {}
}

class WasmHarness {
  static async init() {
    const globals = {};
    MILKDROP_GLOBALS.forEach(name => {
      globals[name] = new WebAssembly.Global(
        { value: "f64", mutable: true },
        0
      );
    });

    const perFrame = fs.readFileSync(
      "./fixtures/youtube_broadcast_yourself_per_frame.eel",
      { encoding: "utf8" }
    );
    const perPixel = fs.readFileSync(
      "./fixtures/youtube_broadcast_yourself_per_pixel.eel",
      { encoding: "utf8" }
    );

    const mod = await loadModule({
      globals,
      functions: {
        perFrame,
        perPixel
      }
    });

    return new WasmHarness(mod, globals);
  }

  constructor(mod, globals) {
    this.globals = globals;
    this.mod = mod;
    this.initEqs = () => {};
    this.frameEqs = () => mod.exports.perFrame();
    this.pixelEqs = () => mod.exports.perFrame();
    this.name = "Wasm";
  }

  setVal(key, val) {
    this.globals[key].value = val;
  }
}

const ITERATIONS = 10000;
function benchmark(harness) {
  Object.entries(presetJson.baseVals).forEach(([key, val]) => {
    harness.setVal(key, val);
  });
  const start = performance.now();
  harness.initEqs();
  for (let i = 0; i < ITERATIONS; i++) {
    harness.frameEqs();
    for (let j = 0; j < 1000; j++) {
      harness.pixelEqs();
    }
  }

  const end = performance.now();
  const duration = end - start;

  const iterationsPerSecond = Math.round(
    (ITERATIONS / duration) * 1000
  ).toLocaleString();

  console.log(harness.name, iterationsPerSecond, "iterations / second");
}

async function main() {
  const jsHarness = new JsHarness(presetJson);
  const wasmHarness = await WasmHarness.init();

  benchmark(jsHarness);
  benchmark(wasmHarness);
}

main();
