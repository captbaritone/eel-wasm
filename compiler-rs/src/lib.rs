mod ast;
mod emitter;
mod file_chars;
mod lexer;
mod ops;
mod parser;
mod span;
mod tokens;

use std::io::Write;

use emitter::Serialize;
use parser::Parser;

pub fn compile(source: &str) -> Result<Vec<u8>, String> {
    let mut parser = Parser::new(source);
    let program = parser.parse()?;
    let mut binary: Vec<u8> = Vec::new();
    program
        .serialize(&mut binary)
        .map_err(|err| format!("{:?}", err))?;
    binary.flush().map_err(|err| format!("{}", err))?;
    Ok(binary)
}
