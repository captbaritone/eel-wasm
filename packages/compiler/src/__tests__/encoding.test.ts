import { encodef64 } from "../encoding";
test("float", () => {
  expect(encodef64(1)).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 240, 63]));
});
