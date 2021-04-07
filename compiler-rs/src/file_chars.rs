use std::mem;
use std::str::Chars;

pub const NULL: char = '!';

pub struct FileChars<'a> {
    chars: Chars<'a>,
    next_char: char,
    pub pos: u32,
}

impl<'a> FileChars<'a> {
    pub fn new(source: &'a str) -> Self {
        let mut chars = source.chars();
        let next_char = chars.next().unwrap_or(NULL);
        FileChars {
            chars,
            next_char,
            pos: 0,
        }
    }

    pub fn next(&mut self) -> char {
        let c = self.next_char;
        self.pos += c.len_utf8() as u32;
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
