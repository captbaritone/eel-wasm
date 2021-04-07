use crate::EelFunctionType;
use parity_wasm::elements::{FunctionType, ValueType};

// TODO: We could use https://docs.rs/strum_macros/0.20.1/strum_macros/index.html
#[derive(PartialEq, Eq, Hash)]
pub enum Shim {
    Sin,
    Pow,
}

impl Shim {
    pub fn get_type(&self) -> EelFunctionType {
        FunctionType::new(self.get_args(), self.get_return())
    }

    pub fn get_args(&self) -> Vec<ValueType> {
        vec![ValueType::F64; self.arity()]
    }

    // All shims return a value
    pub fn get_return(&self) -> Vec<ValueType> {
        vec![ValueType::F64]
    }
    pub fn arity(&self) -> usize {
        match self {
            Shim::Sin => 1,
            Shim::Pow => 2,
        }
    }
    pub fn as_str(&self) -> &str {
        match self {
            Shim::Sin => "sin",
            Shim::Pow => "pow",
        }
    }
    pub fn from_str(name: &str) -> Option<Self> {
        match name {
            "sin" => Some(Shim::Sin),
            "pow" => Some(Shim::Pow),
            _ => None,
        }
    }
}
