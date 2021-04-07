use parity_wasm::elements::{BlockType, FuncBody, Instruction, Instructions, Local, ValueType};

use crate::EelFunctionType;

#[derive(PartialEq, Eq, Hash)]
pub enum BuiltinFunction {
    Div,
}

impl BuiltinFunction {
    pub fn get_type(&self) -> EelFunctionType {
        match self {
            Self::Div => (2, 1),
        }
    }

    pub fn func_body(&self) -> FuncBody {
        match self {
            Self::Div => FuncBody::new(
                vec![Local::new(1, ValueType::I32)],
                Instructions::new(vec![
                    Instruction::GetLocal(1),
                    Instruction::F64Const(0),
                    Instruction::F64Ne,
                    Instruction::If(BlockType::Value(ValueType::F64)),
                    Instruction::GetLocal(0),
                    Instruction::GetLocal(1),
                    Instruction::F64Div,
                    Instruction::Else,
                    Instruction::F64Const(0),
                    Instruction::End,
                    Instruction::End,
                ]),
            ),
        }
    }
}
