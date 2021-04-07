use super::span::Position;
use std::mem;
use std::str::Chars;

pub struct FileChars<'a> {
    chars: Chars<'a>,
    next_char: Option<char>,
    pub pos: Position,
}

impl<'a> FileChars<'a> {
    pub fn new(source: &'a str) -> Self {
        let mut chars = source.chars();
        let next_char = chars.next();
        FileChars {
            chars,
            next_char,
            pos: Position::new(),
        }
    }

    pub fn next(&mut self) -> Option<char> {
        if let Some(c) = self.next_char {
            self.pos.byte_offset += c.len_utf8();
            if c == '\n' {
                self.pos.column = 0;
                self.pos.line += 1;
            } else {
                self.pos.column += 1
            }
        }
        mem::replace(&mut self.next_char, self.chars.next())
    }

    pub fn eat_while<F>(&mut self, predicate: F)
    where
        F: Fn(char) -> bool,
    {
        while match self.next_char {
            Some(c) => predicate(c),
            None => false,
        } {
            self.next();
        }
    }

    pub fn peek(&mut self) -> Option<char> {
        self.next_char
    }
}
