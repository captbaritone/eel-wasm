mod ast;
mod builtin_functions;
mod emitter;
mod error;
mod file_chars;
mod index_store;
mod lexer;
mod parser;
mod shim;
mod span;
mod tokens;

use std::collections::{HashMap, HashSet};

use ast::EelFunction;
use emitter::emit;
use error::CompilerError;
// Only exported for tests
pub use lexer::Lexer;
pub use parser::parse;
pub use tokens::Token;
pub use tokens::TokenKind;

pub type EelFunctionType = (usize, usize);

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn assert_compile(source: &str) -> Vec<u8> {
    compile(
        vec![("test".to_string(), source, "pool".to_string())],
        HashMap::default(),
    )
    .expect("Don't screw it up")
}

pub fn compile(
    sources: Vec<(String, &str, String)>,
    globals: HashMap<String, HashSet<String>>,
) -> Result<Vec<u8>, CompilerError> {
    let eel_functions: Result<Vec<(String, EelFunction, String)>, CompilerError> = sources
        .into_iter()
        .map(|(name, source, pool)| {
            let program = parse(&source)?;
            Ok((name, program, pool))
        })
        .collect();
    emit(eel_functions?, globals)
}
