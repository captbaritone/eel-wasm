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
}
