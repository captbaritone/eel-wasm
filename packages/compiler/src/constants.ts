// https://webassembly.github.io/spec/core/exec/runtime.html#page-size
const WASM_PAGE_SIZE = 65536;

const BYTES_PER_F64 = 8;
const BUFFER_COUNT = 2;

// https://github.com/WACUP/vis_milk2/blob/de9625a89e724afe23ed273b96b8e48496095b6c/ns-eel2/ns-eel.h#L136
export const MAX_LOOP_COUNT = 1048576;

// The number of items allowed in each buffer (megabuf/gmegabuf).
// https://github.com/WACUP/vis_milk2/blob/de9625a89e724afe23ed273b96b8e48496095b6c/ns-eel2/ns-eel.h#L145
export const BUFFER_SIZE = 65536 * 128;

export const WASM_MEMORY_SIZE = Math.ceil(
  (BUFFER_SIZE * BYTES_PER_F64 * BUFFER_COUNT) / WASM_PAGE_SIZE
);
