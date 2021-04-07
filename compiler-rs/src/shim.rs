use crate::EelFunctionType;

// TODO: We could use https://docs.rs/strum_macros/0.20.1/strum_macros/index.html
#[derive(PartialEq, Eq, Hash)]
pub enum Shim {
    Sin,
}

impl Shim {
    pub fn get_type(&self) -> EelFunctionType {
        (self.arity(), 1)
    }
    pub fn arity(&self) -> usize {
        match self {
            Shim::Sin => 1,
        }
    }
    pub fn as_str(&self) -> &str {
        match self {
            Shim::Sin => "sin",
        }
    }
    pub fn from_str(name: &str) -> Option<Self> {
        match name {
            "sin" => Some(Shim::Sin),
            _ => None,
        }
    }
}
