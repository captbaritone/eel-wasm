use crate::EelFunctionType;
use parity_wasm::elements::{FunctionType, ValueType};

// TODO: We could use https://docs.rs/strum_macros/0.20.1/strum_macros/index.html
#[derive(PartialEq, Eq, Hash)]
pub enum Shim {
    Sin,
    Pow,
    Cos,
    Tan,
    Asin,
    Acos,
    Atan,
    Atan2,
    Log,
    Log10,
    Sigmoid,
    Exp,
}

impl Shim {
    pub fn all() -> Vec<Self> {
        vec![
            Shim::Sin,
            Shim::Pow,
            Shim::Cos,
            Shim::Tan,
            Shim::Asin,
            Shim::Acos,
            Shim::Atan,
            Shim::Atan2,
            Shim::Log,
            Shim::Log10,
            Shim::Sigmoid,
            Shim::Exp,
        ]
    }

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
            Shim::Cos => 1,
            Shim::Tan => 1,
            Shim::Asin => 1,
            Shim::Acos => 1,
            Shim::Atan => 1,
            Shim::Atan2 => 2,
            Shim::Log => 1,
            Shim::Log10 => 1,
            Shim::Sigmoid => 2,
            Shim::Exp => 1,
        }
    }
    pub fn as_str(&self) -> &str {
        match self {
            Shim::Sin => "sin",
            Shim::Pow => "pow",
            Shim::Cos => "cos",
            Shim::Tan => "tan",
            Shim::Asin => "asin",
            Shim::Acos => "acos",
            Shim::Atan => "atan",
            Shim::Atan2 => "atan2",
            Shim::Log => "log",
            Shim::Log10 => "log10",
            Shim::Sigmoid => "sigmoid",
            Shim::Exp => "exp",
        }
    }
    pub fn from_str(name: &str) -> Option<Self> {
        match name {
            "sin" => Some(Shim::Sin),
            "pow" => Some(Shim::Pow),
            "cos" => Some(Shim::Cos),
            "tan" => Some(Shim::Tan),
            "asin" => Some(Shim::Asin),
            "acos" => Some(Shim::Acos),
            "atan" => Some(Shim::Atan),
            "atan2" => Some(Shim::Atan2),
            "log" => Some(Shim::Log),
            "log10" => Some(Shim::Log10),
            "sigmoid" => Some(Shim::Sigmoid),
            "exp" => Some(Shim::Exp),
            _ => None,
        }
    }
}
