import { Location } from "./types";

class CompilerError extends Error {
  loc: Location;

  constructor(message: string, loc?: Location) {
    super(message);
    this.message = message;
    this.loc = loc;
  }
}

export function createUserError(message: string, loc?: Location) {
  return new CompilerError(message, loc);
}
