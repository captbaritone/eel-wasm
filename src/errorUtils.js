class CompilerError extends Error {
  constructor(message, loc) {
    super(message);
    this.message = message;
    this.loc = loc;
  }
}
function createUserError(message, loc) {
  throw new CompilerError(message, loc);
}

module.exports = { createUserError };
