use super::file_chars::FileChars;
use super::span::Span;
use super::tokens::{Token, TokenKind};

/**
 * The lexer:
 * - Returns an error if next token is not in the language
 * - Returns EOF forever once it reaches the end
 */

pub struct Lexer<'a> {
    source: &'a str,
    chars: FileChars<'a>,
}

impl<'a> Lexer<'a> {
    pub fn new(source: &'a str) -> Self {
        Lexer {
            source,
            chars: FileChars::new(source),
        }
    }

    pub fn next_token(&mut self) -> Result<Token<'a>, String> {
        let start = self.chars.pos;
        let kind = match self.chars.peek() {
            Some(c) => match c {
                _ if is_int(c) => self.read_int(),
                '+' => self.read_char_as_kind(TokenKind::Plus),
                '-' => self.read_char_as_kind(TokenKind::Minus),
                _ => return Err(format!("Unexpected token {}", c)),
            },
            None => TokenKind::EOF,
        };
        let end = self.chars.pos;
        Ok(Token::new(kind, Span::new(self.source, start, end)))
    }

    fn read_char_as_kind(&mut self, kind: TokenKind) -> TokenKind {
        self.chars.next();
        kind
    }

    fn read_int(&mut self) -> TokenKind {
        self.chars.eat_while(is_int);
        TokenKind::Int
    }
}

fn is_int(c: char) -> bool {
    match c {
        '0'..='9' => true,
        _ => false,
    }
}
