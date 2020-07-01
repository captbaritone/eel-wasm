# EEL → Wasm Compiler

EEL-Wasm is a compiler, written in TypeScript, that can convert Milkdrop EEL source code into a WebAssembly module in the browser. If this makes no sense to you, see the "Motivation" section below.

# Project Status (Alpha)

This project is fully functional according to its test suite, but has not yet been shipped to any real users. We are [currently working](https://github.com/jberg/butterchurn/pull/35) on getting [Butterchurn](https://github.com/jberg/butterchurn) to use it instead of it’s current EEL → JavaScript compiler.

# Motivation

[Butterchun](https://github.com/jberg/butterchurn) is a WebGL implementation of the [Milkdrop 2](http://www.geisswerks.com/about_milkdrop.html) visualizer. It powers the Milkdrop window in [Webamp](https://webamp.org), which is my JavaScript implementation of Winamp 2.

Milkdrop presets, user defined visualizations, consist of shader code as well as EEL code. EEL is a custom programing language made by Nullsoft. Currently Butterchurn handles EEL code by compiling it to JavaScript ahead of time (not in the browser). This works well, but it has a few downsides:

1. In order to load a preset from an arbitrary source — such as the Internet Archive's [collection of ~40k presets](https://archive.org/details/milkdrops) — you must be willing to execute arbitrary JavaScript from that source in the same context as Webamp. This security risk is currently preventing us from enabling Dropbox integration on https://webamp.org.
2. EEL at run time gets us closer to being able to build an in-browser preset editor where the user can edit their preset and see the changes in real time.

Finally, the compiled JavaScript is currently a performance bottleneck for Butterchurn. Some more-complicated presets struggle to render at a good frame rate. We suspect — but don’t know — that WebAssembly could run faster than JavaScript.

In all honesty, this project has been a “solution in search of a problem”. I was curious to learn more about compilers and while thinking about potential projects I could build to teach myself, I came up with this idea.

# Playground

In order to try out the compiler before it’s been integrated into Butterchurn, this repository includes a “playground” website (`packages/playground`) where you can write EEL code in your browser and see/run the compiled Wasm output by the compiler. You can play with it here: https://eel.capt.dev/

# Usage

If you want to use eel-wasm in your project, you can install it from NPM:

```
npm install eel-wasm
```

And then use it like so:

```JavaScript
const { loadModule } = require("eel-wasm");

// Initialize global values avaliable to your EEL scripts (and JS).
// Variables exist in "pools" and each function has access to the 
// varibles in one pool. The keys of the `pools` object are the 
// names of the pools and the keys within each pool object are 
// the names of the variables.
const pools = {
  poolA: {
    x: new WebAssembly.Global({ value: "f64", mutable: true }, 0),
    y: new WebAssembly.Global({ value: "f64", mutable: true }, 0)
  }
};

// Define the EEL scripts that your module will include. The object
// key will become the name of the function on the Wasm module.
const functions = {
  ten: { pool: 'poolA', code: "x = 10;" },
  setXToY: { pool: 'poolA', code: "x = y;" }
};

// Build (compile/initialize) the Wasm module
const mod = await loadModule({ pools, functions });

console.log(`x starts at 0. x:${globals.x.value}`);

// Run a compiled EEL script and see that it ran
mod.exports.ten();
console.log(`x Has been set to 10. x:${globals.x.value}`);

// Change a global value from JS, and see that EEL code uses the new value
globals.y.value = 5;
mod.exports.setXToY();
console.log(`x Has been set to 5. x:${globals.x.value}`);
```

# Tools

To help me build this compiler I wrote a few tools. Below is a description of each one.

## Pretty Printer

The **pretty printer** will take an AST and output EEL source code. This is useful for visualizing optimization passes which operate on the AST.

## Test Preset

To assert the correctness of the compiler I built out a test suite of small EEL snippets that assert various features and edge cases of the language. Our test suite asserts that our compiler passes these assertions. However, to be sure that these assertions actually match the behavior of Milkdrop’s implementation of EEL, I built `buildTestPrest.js` which takes these snippets and builds them into a `.milk` file which can be loaded into Milkdrop.

If the assertions all pass, the preset will render a green background. If they don’t it will render a red background and the `monitor` variable (visible in the upper right hand corner if you press “n”) will be set to the number (1 based index) of the first assertion that fails.

## Parse .milk Files

`parseMilk.js` will take a, potentially large, directory of `.milk` files and attempt to parse (and optionally compile) all of them using eel-wasm looking for errors. It has a number of options including the ability to run until it hits a specific error, or run on all presets and generate a summary of all the failures. Call it with `--help` for a list of the options it supports.

## Performance Benchmark

One outstanding question about the compiler is how its performance compares to Butterchurn’s existing JavaScript compiler. The performance benchmark attempts to measure the performance of our generated Wasm module relative to the compiled JS of Butterchurn. Performance benchmarking is hard as I don’t currently have high confidence in the accuracy of the numbers this generates.

# Architecture

If you are interested in contributing to the compiler, or just reading the source, below is a high-level overview of how it works.

## Preprocessor

The **preprocessor** takes the raw source and strips out newlines and comments. It returns the stripped source as well as a `mapper` artifact which can be passed to `getLoc` to map a column in the stripped source (since new lines are removed, line numbers are not needed) back to the line/column in the raw source.

## Parser

The **parser**, written using `jison`, takes the stripped source emitted by the **preprocessor** and returns an AST.

The AST is annotated with line/column numbers for each node, but those refer to the stripped source, so before returning the AST to the caller, we walk the AST and map the location back to the raw source location using `getLoc`.

The `jison` parser may throw an error if the source is malformed. In that case we catch the error, which has a `.loc` property indicating the location of the error in the stripped source, and map that location back to the location in the raw source.

## Emitter

The **emitter** takes a root AST node as well as a stateful `context` object and recursively builds up an array of integer Wasm instructions representing the [function body](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-func) of this program.

## Compiler

The **compiler** is the top level function which uses the above functions to build a Wasm module. It takes:

- A collection of functions in the form of .eel source code
- A set of variable names indicating which variables should be exposed as globals

The compiler has two large responsibilities:

1. Building up the `context` object needed by the **emitter**
2. Constructing the binary representation of the full Wasm [module](https://webassembly.github.io/spec/core/syntax/modules.html)

It returns a `Uint8Array` which is the binary representation of a Wasm module. When instantiated, the module expects to be passed a `WebAssembly.Global` for each global variable as well as as well as the `shims` object.

## Loader

The **loader** is a nice wrapper around the compiler which will compile the Wasm module and then instantiate and return an instance. It has an API similar to the **compiler** expect that it expects a `WebAssembly.Global` instance for each variable that is exposed to the JavaScript environment.

# Prior Art
- [Milkdrop's EEL compiler](https://github.com/WACUP/vis_milk2/tree/master/ns-eel2), written in C
- [WDL](https://www.cockos.com/wdl/) includes an [EEL2 compiler](https://github.com/justinfrankel/WDL/tree/master/WDL/eel2).
- [Butterchun's existing EEL -> JavaScript compiler](https://github.com/jberg/milkdrop-eel-parser), written in Clojure.
- WebVS includes an [EEL -> JavaScript compiler](https://github.com/azeem/webvs/tree/master/src/expr) written in TypeScript.

# Related Documentation
- Mikdrop Preset documentation: http://www.geisswerks.com/hosted/milkdrop2/milkdrop_preset_authoring.html
- EEL2 Documentation (may vary from EEL): https://www.cockos.com/EEL2/
- Web Assembly spec: https://webassembly.github.io/spec/core/index.html

# Thanks

While working on this project I’ve gotten substantial help from the following people:

- [Jordan Berg](https://twitter.com/jnberg16) for answering countless questions about Milkdrop, EEL, and Butterchurn in Discord
- [Darren Owen](https://twitter.com/The_DoctorO) for lending historical context about Milkdrop
- [Nate Eldredge](https://thatsmathematics.com/blog/about-me/) for many enjoyable conversations about how compilers work
- [Bob Nystrom](https://twitter.com/munificentbob) for his excellent (and free!) book [Crafting Interpreters](https://craftinginterpreters.com/) which helped demystify how to write a compiler
- [Colin Eberhardt](https://twitter.com/ColinEberhardt) for his [simple WebAssembly compiler](https://github.com/ColinEberhardt/chasm) which helped me figure out how to emit binary Wasm directly

