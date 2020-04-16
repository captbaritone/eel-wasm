import { SourceLocation } from "./types";

function repeat(n: number, char: string) {
  return new Array(n).fill(char).join("");
}

function printLoc(loc: SourceLocation, rawSource: string, contextLines = 1) {
  const sourceLines = rawSource.split("\n");
  const annotatedLines: string[] = [];
  const singleLineLoc = loc.first_line === loc.last_line;
  sourceLines.forEach((line, i) => {
    const lineNumber = i + 1;
    if (
      lineNumber < loc.first_line - contextLines ||
      lineNumber > loc.last_line + contextLines
    ) {
      return;
    }
    let gutter = " ";
    if (lineNumber <= loc.first_line && lineNumber >= loc.last_line) {
      gutter = ">";
    }

    annotatedLines.push(`${gutter} ${lineNumber} | ${line}`);

    if (singleLineLoc && lineNumber === loc.first_line) {
      const locLength = loc.last_column - loc.first_column;
      annotatedLines.push(
        `    | ${repeat(loc.first_column, " ")}${repeat(locLength, "^")}`
      );
    }
  });
  return annotatedLines.join("\n");
}

class CompilerError extends Error {
  loc: SourceLocation;
  sourceContext: string;

  constructor(message: string, loc: SourceLocation, rawSource: string) {
    super(message);
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
