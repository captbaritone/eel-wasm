use crate::span::Span;

#[derive(Debug, PartialEq)]
pub struct CompilerError {
    message: String,
    span: Span,
}

impl CompilerError {
    pub fn new(message: String, span: Span) -> Self {
        Self {
            span,
            message: message.into(),
        }
    }

    // TODO: Print a code frame
    pub fn pretty_print(&self, _source: &str) -> String {
        self.message.clone()
    }
}

pub type EmitterResult<T> = Result<T, CompilerError>;
