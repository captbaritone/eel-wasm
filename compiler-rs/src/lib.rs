mod ast;
mod emitter;
mod file_chars;
mod lexer;
mod parser;
mod span;
mod tokens;

use emitter::emit;
use parser::Parser;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn assert_compile(source: &str) -> Vec<u8> {
    compile(source, vec![]).expect("Don't screw it up")
}

pub fn compile(source: &str, globals: Vec<String>) -> Result<Vec<u8>, String> {
    let mut parser = Parser::new(source);
    let program = parser.parse()?;
    emit(program, globals)
}
