/**
 * Runs the portable EEL2 conformance corpus (the `eel-conformance` package)
 * against the compiler's own output.
 *
 * Each case is compiled with `compileModule` and instantiated with this
 * package's own shims, except `rand` and `randint`, which the corpus replaces
 * with a fixed draw so the random cases are deterministic (see the corpus
 * runner contract). Everything else — the parser, the emitter, the local
 * functions — is exactly what `loadModule` ships.
 *
 * eel-wasm keeps megabuf/gmegabuf inside unexported WebAssembly memory, so
 * buffer state is seeded by prepending `megabuf(i) = v` statements and asserted
 * by appending probe reads. Everything the case asserts therefore passes
 * through the compiler's own store and load paths, which is exactly what is
 * being tested.
 *
 * The cases that do not pass are listed in `knownDeviations` below, with the
 * reason for each. This test fails when a case regresses (a passing case
 * stops passing) or when a listed deviation is resolved (so the baseline is
 * kept up to date as the engine improves).
 */
import { describe, expect, test } from "vitest";
import { compileModule, shims } from "../index.js";
import {
  EEL_CONFORMANCE_BUFFER_SLOTS,
  formatReport,
  loadEelConformanceCases,
  qualifiedId,
  runConformance,
} from "eel-conformance";

/**
 * Every corpus case eel-wasm does not pass, by `section/case` id, in two
 * groups. Engine gaps are behaviour eel-wasm is missing; each is deleted by
 * the change that fixes it. Audited deviations were checked against the
 * ns-eel2 source that MilkDrop 2 actually ships (WACUP/vis_milk2 @ de9625a,
 * ns-eel2/) and modern EEL2 (WDL/eel2); most are eel-wasm being correct
 * where the corpus case pins the wrong behaviour, and corrections are
 * proposed upstream. See the case-by-case audit:
 * https://github.com/zz-plant/stims/pull/1567
 */
const knownDeviations = [
  // ---------------------------------------------------------------------
  // Engine gaps: cases eel-wasm fails today. Each group is removed by the
  // compiler change that fixes it, so the list burns down one change at a
  // time.
  // ---------------------------------------------------------------------

  // Builtins eel-wasm does not define yet.
  "functions-math/invsqrt",
  "functions-math/invsqrt-nonpositive",
  "functions-utility/clamp",
  "functions-utility/clamp-default-bounds",
  "functions-utility/clamp-inverted-bounds",
  "functions-utility/frac-is-floor-based",
  "functions-utility/mix-and-lerp",
  "functions-utility/smoothstep-degenerate-edges",
  "functions-utility/smoothstep-midpoint",
  "functions-utility/step-edge-first",

  // ---------------------------------------------------------------------
  // Audited deviations: the corpus was checked against the ns-eel2 source
  // MilkDrop 2 ships. For most of these, eel-wasm matches ns-eel2 and the
  // corpus case is what's wrong; corrections are proposed upstream.
  // ---------------------------------------------------------------------

  // `mod()` and the `%` operator truncate their operands to integers before
  // taking the remainder. ns-eel2 has no user-facing `mod()` at all (only
  // the internal `_mod`, which does the same integer dance), so this case
  // pins an extension; the float-remainder assertions fail.
  "operators-arithmetic/mod-fn-is-float",
  // CORPUS CASE IS WRONG: ns-eel2 maps `%` to `_mod`, and `pow`/`exp` are the
  // raw C functions, which return Infinity on overflow — no finite clamp.
  "operators-arithmetic/pow-overflow-clamps",
  // CORPUS PROVISIONAL PIN IS WRONG for ns-eel2: the preprocessor rewrites
  // `x = -2^2` to `_set(x, -pow(2,2))` = -4, which is what we produce.
  // (Modern EEL2 differs: unary minus is an operand of `^` there, giving +4.)
  "operators-arithmetic/precedence-unary-minus-over-pow",
  // CORPUS CASE IS WRONG: ns-eel2's `_equal` (which `==` lowers to) receives
  // g_closefact and compares |a-b| against it — `==` uses the close factor.
  // Only modern EEL2's `===` is exact.
  "operators-logical/equality-operator-is-exact",
  // CORPUS CASE IS WRONG: ns-eel2's `nseel_asm_sqrt` is `fabs` then `fsqrt`,
  // and modern EEL2 registers `sqrt_fabs` — sqrt(-4) is 2 in both.
  "functions-math/sqrt-negative-is-zero",
  // CORPUS CASE IS WRONG: ns-eel2's `log` is `fldln2; fyl2x` (log(0) is
  // -Infinity) and modern EEL2 uses the raw C `log`.
  "functions-math/log-zero-is-zero",
  // CORPUS CASE IS WRONG: raw C `exp` has no overflow clamp.
  "functions-math/exp-overflow-clamps-at-store",
  // CORPUS CASE IS WRONG: ns-eel2's `nseel_lookup` aliases `int` to `floor`.
  "functions-utility/int-truncates-toward-zero",
  // Same root cause: `int()` and `floor()` are one function.
  "functions-utility/floor-int-ceil-differ",
  // CORPUS CASE IS WRONG for ns-eel2: `nseel_getBufferIndex` adds EPSILON
  // before truncating, so a -1 index lands in slot 0 (a documented MilkDrop
  // bug that this engine reproduces intentionally).
  "buffers/negative-index-write-dropped",
  // CORPUS CASE IS WRONG: ns-eel2 spells its constants `$pi`/`$e`
  // (preprocessor macros); bare `pi`/`e` are ordinary zero-init variables.
  "variables/pi-and-e-default",
  // CORPUS PROVISIONAL PIN IS WRONG: ns-eel2's `nseel_asm_repeatwhile` and
  // modern EEL2's `fptobool` both test |v| against the close factor, so a
  // while condition of 1e-6 exits the loop.
  "control-flow/while-condition-is-exact-zero",
];

const POOL_NAME = "conformance";

/**
 * ns-eel2 spells its constants `$pi`/`$e` (preprocessor macros); bare `pi`
 * and `e` are ordinary zero-initialized variables. The corpus's
 * `pi-and-e-default` case pins the macro VALUES under the bare-variable
 * SPELLING, so it fails here — correctly, per the ns-eel2 source. The runner
 * still keeps these names out of the pool (they are declared on demand) and
 * reads their values back through probe statements.
 */
const PREPOPULATED = new Set(["pi", "e"]);

/** Matches identifiers that are not immediately called as functions. */
const VAR_TOKEN = /[a-z_][a-z0-9_]*(?!\s*\()/gi;

const f64Global = (value: number) =>
  new WebAssembly.Global({ value: "f64", mutable: true }, value);

const formatValue = (value: number) =>
  Number.isInteger(value) ? String(value) : JSON.stringify(value);

const probeName = (kind: string, index: number | string) =>
  `__probe_${kind}_${index}`;

function createRunner(specCase: any) {
  const megabufSlots = Object.keys(specCase.expectedMegabuf ?? {}).map(Number);
  const gmegabufSlots = Object.keys(specCase.expectedGmegabuf ?? {}).map(
    Number
  );
  const expectedNames = Object.keys(specCase.expected).map((key: string) =>
    key.toLowerCase()
  );

  return async ({
    program,
    env,
    megabuf,
    gmegabuf,
    random,
  }: any): Promise<void> => {
    // Expected variables the engine prepopulates are read through probes so
    // the engine's own initialization is what gets tested.
    const probedExpected = expectedNames.filter(
      (name: string) => PREPOPULATED.has(name) && !(name in env)
    );
    const probedExpectedNames = expectedNames.filter(
      (name: string) => !probedExpected.includes(name)
    );

    const preloads: string[] = [];
    ["megabuf", "gmegabuf"].forEach((name, i) => {
      const buffer = i === 0 ? megabuf : gmegabuf;
      for (let slot = 0; slot < buffer.length; slot++) {
        if (buffer[slot] !== 0) {
          preloads.push(`${name}(${slot}) = ${formatValue(buffer[slot])}`);
        }
      }
    });
    const probes = [
      ...megabufSlots.map(
        (slot, i) => `${probeName("mb", i)} = megabuf(${slot})`
      ),
      ...gmegabufSlots.map(
        (slot, i) => `${probeName("gb", i)} = gmegabuf(${slot})`
      ),
      ...probedExpected.map(name => `${probeName("exp", name)} = ${name}`),
    ];
    const statements = [...preloads, ...program, ...probes];

    const pool: { [name: string]: WebAssembly.Global } = {};
    const declare = (name: string, value = 0) => {
      const key = name.toLowerCase();
      if (PREPOPULATED.has(key) && !(key in env)) {
        // Leave prepopulated variables to the engine.
        return;
      }
      if (!(key in pool)) {
        pool[key] = f64Global(value);
      }
    };
    for (const [key, value] of Object.entries(env)) {
      declare(key, value as number);
    }
    for (const name of expectedNames) {
      declare(name);
    }
    for (const line of specCase.program) {
      for (const match of line.matchAll(VAR_TOKEN)) {
        declare(match[0]);
      }
    }
    megabufSlots.forEach((_, i) => declare(probeName("mb", i)));
    gmegabufSlots.forEach((_, i) => declare(probeName("gb", i)));
    probedExpected.forEach(name => declare(probeName("exp", name)));

    // The corpus's runner contract requires a fixed random draw.
    const fixedShims = {
      ...shims,
      rand: (max: number) => random() * (max === undefined ? 1 : max),
      randint: (max: number) =>
        Math.floor(random() * (max === undefined ? 1 : max)),
    };

    const wasmBytes = compileModule({
      pools: { [POOL_NAME]: new Set(Object.keys(pool)) },
      functions: {
        conformance: { pool: POOL_NAME, code: statements.join("; ") },
      },
    });
    const { instance } = await WebAssembly.instantiate(wasmBytes, {
      [POOL_NAME]: pool,
      shims: fixedShims,
    });
    (instance.exports as { [name: string]: () => void }).conformance();

    for (const [key] of Object.entries(env)) {
      env[key] = pool[key].value;
    }
    for (const name of probedExpectedNames) {
      env[name] = pool[name].value;
    }
    for (const name of probedExpected) {
      env[name] = pool[probeName("exp", name)].value;
    }
    megabufSlots.forEach((slot, i) => {
      if (slot >= 0 && slot < EEL_CONFORMANCE_BUFFER_SLOTS) {
        megabuf[slot] = pool[probeName("mb", i)].value;
      }
    });
    gmegabufSlots.forEach((slot, i) => {
      if (slot >= 0 && slot < EEL_CONFORMANCE_BUFFER_SLOTS) {
        gmegabuf[slot] = pool[probeName("gb", i)].value;
      }
    });
  };
}

describe("EEL2 conformance corpus", () => {
  test("every corpus case passes unless listed in knownDeviations", async () => {
    const cases = loadEelConformanceCases();
    const buffers = {
      megabuf: new Float32Array(EEL_CONFORMANCE_BUFFER_SLOTS),
      gmegabuf: new Float32Array(EEL_CONFORMANCE_BUFFER_SLOTS),
    };

    const results = [];
    for (const specCase of cases) {
      const single = await runConformance(createRunner(specCase), {
        cases: [specCase],
        buffers,
      });
      results.push(...single.results);
    }

    const report = {
      total: results.length,
      passed: results.filter(r => r.status === "pass").length,
      failed: results.filter(r => r.status === "fail").length,
      errored: results.filter(r => r.status === "error").length,
      pinnedFailures: results.filter(
        r => r.status !== "pass" && r.case.status !== "provisional"
      ).length,
      provisionalFailures: results.filter(
        r => r.status !== "pass" && r.case.status === "provisional"
      ).length,
      results,
    };

    console.log(formatReport(report));

    const nonPassing = results
      .filter(result => result.status !== "pass")
      .map(result => qualifiedId(result.case))
      .sort();
    const baseline = [...knownDeviations].sort();

    const regressions = nonPassing.filter(id => !baseline.includes(id));
    const resolved = baseline.filter(id => !nonPassing.includes(id));

    expect(regressions).toEqual([]);
    expect(resolved).toEqual([]);

    // Sanity: the corpus must not silently shrink.
    expect(report.total).toBe(82);
  });
});
