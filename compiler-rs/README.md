## Build

To build the Wasm module:
```bash
wasm-pack build
```

You can find the output in `pkg/`.

## TODO

- [ ] Add AST node for arguments list so that we can show it as the error node when arg count is wrong.
- [ ] Run `wasm-pack build` in CI.
- [ ] Should the magicness of reg10 values be case insensitive? (It is in the JS version)