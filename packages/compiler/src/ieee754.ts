
export function write(buffer: Uint8Array, value: number) {
  const base =
    new ArrayBuffer(8)
  const view =
    new DataView(base)

  view.setFloat64(0, value)

  const result =
    (new Uint8Array(base)).reverse()

  buffer.set(result, 0)
}
