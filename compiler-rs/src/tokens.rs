use super::span::Span;

#[derive(Debug, PartialEq)]
pub enum TokenKind {
    Int,
    Plus,
    Minus,
    EOF,
    SOF, // Allows TokenKind to be non-optional in the parser
}

#[derive(Debug, PartialEq)]
pub struct Token<'a> {
    pub kind: TokenKind,
    pub span: Span<'a>,
}

impl<'a> Token<'a> {
    pub fn new(kind: TokenKind, span: Span<'a>) -> Self {
        Token { kind, span }
    }
}
