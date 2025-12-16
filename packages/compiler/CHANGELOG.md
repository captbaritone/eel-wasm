# Changelog

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
