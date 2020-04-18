import { SourceLocation } from "./types";

function repeat(n: number, char: string) {
  return new Array(n).fill(char).join("");
}

/* Build up a string showing a formatted source location in context with line numbers.
 *
 *   2 | z = sqr(y, 10);
 * > 3 | x = wat();
 *     |     ^^^
 *   4 | y = 100;
 */

export function printLoc(
  loc: SourceLocation,
  rawSource: string,
  contextLines = 1
) {
  const firstIndex = Math.max(loc.first_line - 1 - contextLines, 0);
  const lastIndex = loc.last_line + contextLines;

  const sourceLines = rawSource.split("\n").slice(firstIndex, lastIndex);

  const annotatedLines = sourceLines.map((line, i) => {
    const lineNumber = i + firstIndex + 1;
    const inRange = lineNumber >= loc.first_line && lineNumber <= loc.last_line;
    const gutter = inRange ? ">" : " ";
    return `${gutter} ${lineNumber} | ${line}`;
  });

  if (loc.first_line === loc.last_line) {
    const padding = repeat(loc.first_column, " ");
    const underline = repeat(loc.last_column - loc.first_column, "^");
    const insertIndex = loc.first_line - firstIndex;
    annotatedLines.splice(insertIndex, 0, `    | ${padding}${underline}`);
  }

  return annotatedLines.join("\n");
}

class CompilerError extends Error {
  loc: SourceLocation;
  sourceContext: string;

  constructor(message: string, loc: SourceLocation, rawSource: string) {
    super(message);
    // TODO: Create an error message that encourages users to open an issue at
    // https://github.com/captbaritone/eel-wasm/issues is they see this, and gives
    // Them an easy way to attach the right context.
    this.sourceContext = printLoc(loc, rawSource);
    this.loc = loc;
  }
}

class UserError extends CompilerError {}

export function createUserError(
  message: string,
  loc: SourceLocation,
  rawSource: string
) {
  return new UserError(message, loc, rawSource);
}

export function createCompilerError(
  message: string,
  loc: SourceLocation,
  rawSource: string
) {
  return new CompilerError(message, loc, rawSource);
}
