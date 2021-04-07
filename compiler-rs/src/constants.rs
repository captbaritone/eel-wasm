pub static EPSILON: f64 = 0.00001;

pub static WASM_PAGE_SIZE: u32 = 65536;

static BYTES_PER_F64: u32 = 8;
static BUFFER_COUNT: u32 = 2;

// The number of items allowed in each buffer (megabuf/gmegabuf).
// https://github.com/WACUP/vis_milk2/blob/de9625a89e724afe23ed273b96b8e48496095b6c/ns-eel2/ns-eel.h#L145
pub static BUFFER_SIZE: u32 = 65536 * 128;

pub static WASM_MEMORY_SIZE: u32 = (BUFFER_SIZE * BYTES_PER_F64 * BUFFER_COUNT) / WASM_PAGE_SIZE;
