use super::span::Position;
use std::mem;
use std::str::Chars;

pub const NULL: char = '!';

pub struct FileChars<'a> {
    chars: Chars<'a>,
    next_char: char,
    pub pos: Position,
}

impl<'a> FileChars<'a> {
    pub fn new(source: &'a str) -> Self {
        let mut chars = source.chars();
        let next_char = chars.next().unwrap_or(NULL);
        FileChars {
            chars,
            next_char,
            pos: Position::new(),
        }
    }

    pub fn next(&mut self) -> char {
        let c = self.next_char;
        self.pos.byte_offset += c.len_utf8();
        if c == '\n' {
            self.pos.column = 0;
            self.pos.line += 1;
        } else {
            self.pos.column += 1
        }

        mem::replace(&mut self.next_char, self.chars.next().unwrap_or(NULL))
    }

    pub fn eat_while<F>(&mut self, predicate: F)
    where
        F: Fn(char) -> bool,
    {
        while predicate(self.next_char) {
            self.next();
        }
    }

    pub fn peek(&mut self) -> char {
        self.next_char
    }
}
