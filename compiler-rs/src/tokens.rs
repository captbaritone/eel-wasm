use super::span::Span;

#[derive(Debug, PartialEq)]
pub enum TokenKind {
    Int,
    Plus,
    Minus,
    Bang,
    Asterisk,
    Slash,
    Equal,
    Identifier,
    OpenParen,
    CloseParen,
    Comma,
    Semi,
    DoubleEqual,
    Percent,
    And,
    AndAnd,
    PipePipe,
    Pipe,
    Caret,
    PlusEqual,
    MinusEqual,
    OpenAngel,
    CloseAngel,
    LTEqual,
    GTEqual,
    NotEqual,
    TimesEqual,
    DivEqual,
    ModEqual,
    Than,
    EOF,
    SOF, // Allows TokenKind to be non-optional in the parser
}

#[derive(Debug, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub span: Span,
}

impl Token {
    pub fn new(kind: TokenKind, span: Span) -> Self {
        Token { kind, span }
    }
}
