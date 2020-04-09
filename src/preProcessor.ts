// Started with this function: https://github.com/WACUP/vis_milk2/blob/cc2e85aed44373d0b6b2115c0806ec035856860a/vis_milk2/state.cpp#L1532-L1557
export function preProcess(src: string): string {
  let dest = "";
  let inlineComment = false;
  let blockComment = false;
  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    const nextChar = src[i + 1];

    if (char === "\r" && nextChar === "\n") {
      inlineComment = false;
      i++;
    } else if (char === "*" && nextChar === "/") {
      blockComment = false;
      i++;
    } else if (
      (char === "\\" && nextChar === "\\") ||
      (char === "/" && nextChar === "/")
    ) {
      inlineComment = true;
      i++;
    } else if (char === "/" && nextChar === "*") {
      blockComment = true;
      i++;
    } else if (!inlineComment && !blockComment) {
      dest += char;
    }
  }

  return dest;
}
