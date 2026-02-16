use std::mem;
use std::str::Chars;

pub const NULL: char = '\0';

pub struct FileChars<'a> {
    chars: Chars<'a>,
    pub next: char,
    pub pos: u32,
}

impl<'a> FileChars<'a> {
    pub fn new(source: &'a str) -> Self {
        let mut chars = source.chars();
        let next = chars.next().unwrap_or(NULL);
        FileChars {
            chars,
            next,
            pos: 0,
        }
    }

    pub fn next(&mut self) -> char {
        let c = self.next;
        self.pos += c.len_utf8() as u32;
        mem::replace(&mut self.next, self.chars.next().unwrap_or(NULL))
    }

    pub fn eat_while<F>(&mut self, predicate: F)
    where
        F: Fn(char) -> bool,
    {
        while predicate(self.next) && self.next != NULL {
            self.next();
        }
    }
}
