#[derive(Debug, PartialEq, Copy, Clone, Eq)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

impl Span {
    pub fn new(start: u32, end: u32) -> Self {
        Span { start, end }
    }
    pub fn empty() -> Self {
        Span { start: 0, end: 0 }
    }
}
