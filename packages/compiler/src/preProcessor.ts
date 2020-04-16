export type Mapper = { destCol: number; srcCol: number; srcLine: number }[];
type Point = { line: number; column: number };

export function getLoc(mapper: Mapper, destCol: number): Point {
  let previousAnchor = { destCol: 1, srcCol: 1, srcLine: 1 };

  // Find the last anchor with a destCol > destCol.
  // Reversed: Find the first anchor with a destCol <= destCol
  // TODO: Use binary search
  mapper.forEach(anchor => {
    if (anchor.destCol > destCol) {
      return;
    }
    previousAnchor = anchor;
  });

  const remainingColumns = destCol - previousAnchor.destCol;
  return {
    column: previousAnchor.srcCol + remainingColumns,
    line: previousAnchor.srcLine,
  };
}

// Started with this function: https://github.com/WACUP/vis_milk2/blob/cc2e85aed44373d0b6b2115c0806ec035856860a/vis_milk2/state.cpp#L1532-L1557
export function preProcess(src: string): [string, Mapper] {
  const mapper: Mapper = [];
  let srcLine = 1;

  let dest = "";
  let lineStart = 0;
  let inlineComment = false;
  let blockComment = false;
  let emitAnchor = false;
  for (let i = 0; i < src.length; i++) {
    const char = src[i];

    if (emitAnchor) {
      const destCol = dest.length + 1;
      const srcCol = i - lineStart + 1;
      mapper.push({ destCol, srcCol, srcLine });
      emitAnchor = false;
    }

    if (char === "\n") {
      inlineComment = false;
      srcLine++;
      lineStart = i + 1;
      emitAnchor = true;
    } else if (char === "\r" && src[i + 1] === "\n") {
      i++;

      inlineComment = false;
      srcLine++;
      lineStart = i + 1;
      emitAnchor = true;
    } else if (blockComment && char === "*" && src[i + 1] === "/") {
      // TODO: What if we are not currently in a block comment?
      blockComment = false;
      i++;
      emitAnchor = true;
    } else if (
      (char === "\\" && src[i + 1] === "\\") ||
      (char === "/" && src[i + 1] === "/")
    ) {
      inlineComment = true;
      i++;
    } else if (char === "/" && src[i + 1] === "*") {
      blockComment = true;
      i++;
    } else if (!inlineComment && !blockComment) {
      dest += char;
    }
  }

  return [dest, mapper];
}
