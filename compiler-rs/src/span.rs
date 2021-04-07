# [derive (Debug, PartialEq, Clone, Copy)]
pub struct Position {
    pub byte_offset: usize,
    pub line: usize,
    pub column: usize,
}

impl Position {
    pub fn new () -> Self {
        Position {
            byte_offset: 0,
            line: 0,
            column: 0,
        }
    }
}

# [derive (Debug, PartialEq)]
pub struct Span <'a> {
    source: & 'a str,
    pub start: Position,
    pub end: Position,
}

impl <'a> Span <'a> {
    pub fn new (source: & 'a str, start: Position, end: Position) -> Self {
        Span {source, start, end}
    }
    pub fn start_of_file (source: & 'a str) -> Self {
        Span :: new (source, Position :: new (), Position :: new ())
    }
    pub fn str_from_source (& self) -> & 'a str {
        & self.source [self.start.byte_offset..self.end.byte_offset]
    }
}