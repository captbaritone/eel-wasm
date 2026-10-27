# Changelog

## Unreleased

- Add missing EEL2 builtins: `fmod()`, `invsqrt()`, `frac()`, `clamp()`, `mix()`, `lerp()`, `step()`, `smoothstep()`, and `randint()`
- Support `min()`/`max()` with more than two arguments
- Support `rand()`/`randint()` with no argument (draws over `[0, 1)`)
- Support `while(cond, body)` (two arguments), including MilkDrop's `while (cond) (body)` statement syntax
- Fix a regression in `%` with a negative dividend (e.g. `(-7) % 3` returned `1` instead of `-1`) introduced by the out-of-range mod handling in 0.0.17
- Run the portable [EEL2 conformance corpus](https://github.com/zz-plant/stims/tree/main/packages/eel-conformance) (82 cases) as part of the test suite, with the remaining deviations documented in the test

## 0.0.17

- Emit debug symbols for better debugging experience
- Handle out of range values for mod operator (#62)

## 0.0.16

- Export types properly for TypeScript consumers
- Convert to ES modules (#60)
- Avoid emitting code that breaks ES module parsers (#58)
- A much more efficient IEEE-754 writer (#56)

## 0.0.15

- Fix: Avoid crashing when using mod (`%`) with value between 0 and 1. [#54](https://github.com/captbaritone/eel-wasm/issues/54)

## 0.0.14

Initial shipped release. Shipped in Butterchurn and on Webamp.org.
