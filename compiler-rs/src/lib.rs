mod ast;
mod emitter;
mod error;
mod file_chars;
mod lexer;
mod parser;
mod span;
mod tokens;

use ast::Program;
use emitter::emit;
use error::CompilerError;
use parser::Parser;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn assert_compile(source: &str) -> Vec<u8> {
    compile(vec![("test".to_string(), source)], vec![]).expect("Don't screw it up")
}

pub fn compile(
    sources: Vec<(String, &str)>,
    globals: Vec<String>,
) -> Result<Vec<u8>, CompilerError> {
    let programs: Result<Vec<(String, Program)>, CompilerError> = sources
        .into_iter()
        .map(|(name, source)| {
            let mut parser = Parser::new(&source);
            Ok((name, parser.parse()?))
        })
        .collect();
    emit(programs?, globals)
}
