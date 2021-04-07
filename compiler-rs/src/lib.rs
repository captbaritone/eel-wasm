mod ast;
mod emitter;
mod file_chars;
mod lexer;
mod ops;
mod parser;
mod span;
mod tokens;

use emitter::emit;
use parser::Parser;

pub fn compile(source: &str) -> Result<Vec<u8>, String> {
    let mut parser = Parser::new(source);
    let program = parser.parse()?;
    emit(program)
}
