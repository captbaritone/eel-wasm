# EEL -> Wasm Compiler

EEL (or NS-EEL) is a small expression language that is used in a handful of applications to allow users to author plugins or presets. Both AVS and Milkdrop, the audio visualizors for Winamp, allowed users to author "presets" which were user defined visualizations. Both types of presets used EEL as the language that users would write their equations.

## Motivation

[Butterchurn](https://butterchurnviz.com/) is a web project that allows Milkdrop presets to be run in the browser. It works by pre-compiling the preset to a `.json` representation which can then be distributed. The shader portion of the preset is compiled to WebGL2 and the EEL portion of the preset is converted to JavaScript. This presents a security issue, since a Butterchurn `.json` file could contain malicious JavaScript which would be executed in the context of the page rendering the Butterchurn preset.

The **main goal** of this project is to compile the Milkdrop preset's EEL code to Wasm so that it can be executed in a sandbox that cannot access the reset of the JavaScript environment.

A **secondary goal** is to improve the performance of Butterchurn. Currently executing the compiled EEL code is a major performance bottlneck of Butterchurn. It seems possible that Wasm version of this code could execute more efficently thus improving Buttterchurn's overall performance.

## Status

This project is currently just a sketch of a proof of concept.

## TODO

- [ ] Fails in Node 10 with "CompileError: AsyncCompile: Wasm decoding failed: mutable globals cannot be imported @+42"
- [ ] Are expressions folled by a `;` valid statements, or is that just assignements?
- [ ] Check if Milkdrop `if(test, consiquent, alternate)` is actually supposed to shortcircut.

## Challenges

- [ ] Wasm exposes no trig functions. We'll have to write our own?
- [ ] Wasm exposes no rand function. We'll have to write our own? Where do we get our seed?


## How to use this project

Currently all you can do is run some tests:

```
yarn
yarn test
```

## Prior Art

* [Milkdrop's EEL compiler](https://github.com/WACUP/vis_milk2/tree/master/ns-eel2), written in C
* [WDL](https://www.cockos.com/wdl/) includes an [EEL2 compiler](https://github.com/justinfrankel/WDL/tree/master/WDL/eel2).
* [Butterchun's existing EEL -> JavaScript compiler](https://github.com/jberg/milkdrop-eel-parser), written in Clojure.
* WebVS includes an [EEL -> JavaScript compiler](https://github.com/azeem/webvs/tree/master/src/expr) written in TypeScript.

## Related Documentation

- Mikdrop Preset documentation: http://www.geisswerks.com/hosted/milkdrop2/milkdrop_preset_authoring.html
- EEL2 Documentation (may vary from EEL): https://www.cockos.com/EEL2/
- Web Assembly spec: https://webassembly.github.io/spec/core/index.html

