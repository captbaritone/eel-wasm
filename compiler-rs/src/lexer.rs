use crate::error::CompilerError;

use super::file_chars::{FileChars, NULL};
use super::span::Span;
use super::tokens::{Token, TokenKind};

/**
 * The lexer:
 * - Returns an error if next token is not in the language
 * - Returns EOF forever once it reaches the end
 */

type LexerResult<T> = Result<T, CompilerError>;

pub struct Lexer<'a> {
    source: &'a str,
    chars: FileChars<'a>,
}

// TODO: Consider https://github.com/maciejhirsz/logos
impl<'a> Lexer<'a> {
    pub fn new(source: &'a str) -> Self {
        Lexer {
            source,
            chars: FileChars::new(source),
        }
    }

    pub fn next_token(&mut self) -> LexerResult<Token> {
        let start = self.chars.pos;
        let kind = match self.chars.peek() {
            c if is_int(c) => self.read_number(),
            '.' => self.read_number(),
            c if is_identifier_head(c) => self.read_identifier(),
            '+' => self.read_char_as_kind(TokenKind::Plus),
            '-' => self.read_char_as_kind(TokenKind::Minus),
            '*' => self.read_char_as_kind(TokenKind::Asterisk),
            '/' => self.read_char_as_kind(TokenKind::Slash),
            '=' => self.read_char_as_kind(TokenKind::Equal),
            '(' => self.read_char_as_kind(TokenKind::OpenParen),
            ')' => self.read_char_as_kind(TokenKind::CloseParen),
            ',' => self.read_char_as_kind(TokenKind::Comma),
            ';' => self.read_char_as_kind(TokenKind::Semi),
            '!' => self.read_char_as_kind(TokenKind::Bang),
            c if is_whitepsace(c) => {
                self.chars.eat_while(is_whitepsace);
                return self.next_token();
            }
            NULL => TokenKind::EOF,
            c => {
                return Err(CompilerError::new(
                    format!("Parse Error: Unexpected character '{}'.", c),
                    Span::new(start, start),
                ))
            }
        };
        let end = self.chars.pos;
        Ok(Token::new(kind, Span::new(start, end)))
    }

    fn read_char_as_kind(&mut self, kind: TokenKind) -> TokenKind {
        self.chars.next();
        kind
    }

    fn read_number(&mut self) -> TokenKind {
        if is_int(self.chars.peek()) {
            self.chars.next();
            self.chars.eat_while(is_int);
        }
        if self.chars.peek() == '.' {
            self.chars.next();
            self.chars.eat_while(is_int);
        }
        TokenKind::Int
    }

    fn read_identifier(&mut self) -> TokenKind {
        self.chars.next();
        self.chars.eat_while(is_identifier_tail);
        TokenKind::Identifier
    }

    pub fn source(&self, span: Span) -> &str {
        &self.source[span.start as usize..span.end as usize]
    }
}

// https://github.com/justinfrankel/WDL/blob/63943fbac273b847b733aceecdb16703679967b9/WDL/eel2/eel2.l#L93
fn is_identifier_head(c: char) -> bool {
    match c {
        'a'..='z' | 'A'..='Z' | '_' => true,
        _ => false,
    }
}

// https://github.com/justinfrankel/WDL/blob/63943fbac273b847b733aceecdb16703679967b9/WDL/eel2/eel2.l#L93
fn is_identifier_tail(c: char) -> bool {
    match c {
        'a'..='z' | 'A'..='Z' | '0'..='9' | '_' => true,
        _ => false,
    }
}

fn is_int(c: char) -> bool {
    match c {
        '0'..='9' => true,
        _ => false,
    }
}

fn is_whitepsace(c: char) -> bool {
    c.is_whitespace()
}

#[test]
fn can_lex_number() {
    let mut lexer = Lexer::new("1");
    let mut token_kinds: Vec<TokenKind> = vec![];
    loop {
        let token = lexer.next_token().expect("token");
        let done = token.kind == TokenKind::EOF;
        token_kinds.push(token.kind);
        if done {
            break;
        }
    }
    assert_eq!(token_kinds, vec![TokenKind::Int, TokenKind::EOF]);
}

#[test]
fn can_lex_assignment() {
    let mut lexer = Lexer::new("g=1");
    let mut token_kinds: Vec<TokenKind> = vec![];
    loop {
        let token = lexer.next_token().expect("token");
        let done = token.kind == TokenKind::EOF;
        token_kinds.push(token.kind);
        if done {
            break;
        }
    }
    assert_eq!(
        token_kinds,
        vec![
            TokenKind::Identifier,
            TokenKind::Equal,
            TokenKind::Int,
            TokenKind::EOF
        ]
    );
}
