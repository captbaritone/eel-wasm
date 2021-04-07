use parity_wasm::elements::{
    BlockType, FuncBody, FunctionType, Instruction, Instructions, Local, ValueType,
};

use crate::constants::{BUFFER_SIZE, EPSILON};
use crate::utils::f64_const;
use crate::EelFunctionType;

#[derive(PartialEq, Eq, Hash)]
pub enum BuiltinFunction {
    Div,
    Mod,
    GetBufferIndex,
    BitwiseAnd,
    BitwiseOr,
}

impl BuiltinFunction {
    pub fn get_type(&self) -> EelFunctionType {
        match self {
            Self::Div => {
                FunctionType::new(vec![ValueType::F64, ValueType::F64], vec![ValueType::F64])
            }
            Self::GetBufferIndex => FunctionType::new(vec![ValueType::F64], vec![ValueType::I32]),
            Self::Mod => {
                FunctionType::new(vec![ValueType::F64, ValueType::F64], vec![ValueType::F64])
            }
            Self::BitwiseAnd => {
                FunctionType::new(vec![ValueType::F64, ValueType::F64], vec![ValueType::F64])
            }
            Self::BitwiseOr => {
                FunctionType::new(vec![ValueType::F64, ValueType::F64], vec![ValueType::F64])
            }
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
            // Takes a float buffer index and converts it to an int. Values out of range
            // are returned as `-1`.
            //
            // NOTE: There's actually a subtle bug that exists in Milkdrop's Eel
            // implementation, which we reproduce here.
            //
            // Wasm's `trunc()` rounds towards zero. This means that for index `-1` we
            // will return zero, since: `roundTowardZero(-1 + EPSILON) == 0`
            //
            // A subsequent check handles negative indexes, so negative indexes > than
            // `-1` are not affected.
            Self::GetBufferIndex => FuncBody::new(
                vec![Local::new(1, ValueType::F64), Local::new(1, ValueType::I32)],
                Instructions::new(vec![
                    Instruction::F64Const(f64_const(EPSILON)),
                    Instruction::GetLocal(0),
                    Instruction::F64Add,
                    // STACK: [$i + EPSILON]
                    Instruction::TeeLocal(1), // $with_near
                    Instruction::I32TruncSF64,
                    // TODO We could probably make this a tee and get rid of the next get if we swap the final condition
                    Instruction::SetLocal(2),
                    // STACK: []
                    Instruction::I32Const(-1),
                    Instruction::GetLocal(2),
                    // STACK: [-1, $truncated]
                    Instruction::I32Const(8),
                    Instruction::I32Mul,
                    // STACK: [-1, $truncated * 8]
                    Instruction::GetLocal(2), // $truncated
                    Instruction::I32Const(0),
                    // STACK: [-1, $truncated * 8, $truncated, 0]
                    Instruction::I32LtS,
                    // STACK: [-1, $truncated * 8, <is index less than 0>]
                    Instruction::GetLocal(2), // $truncated
                    Instruction::I32Const(BUFFER_SIZE as i32 - 1),
                    Instruction::I32GtS,
                    // STACK: [-1, $truncated * 8, <is index less than 0>, <is index more than MAX>]
                    Instruction::I32Or,
                    // STACK: [-1, $truncated * 8, <is index out of range>]
                    Instruction::Select,
                    Instruction::End,
                ]),
            ),
            Self::Mod => FuncBody::new(
                vec![],
                Instructions::new(vec![
                    Instruction::GetLocal(1),
                    Instruction::F64Const(f64_const(0.0)),
                    Instruction::F64Ne,
                    Instruction::If(BlockType::Value(ValueType::F64)),
                    Instruction::GetLocal(0),
                    Instruction::I64TruncSF64,
                    Instruction::GetLocal(1),
                    Instruction::I64TruncSF64,
                    Instruction::I64RemS,
                    Instruction::F64ConvertSI64,
                    Instruction::Else,
                    Instruction::F64Const(f64_const(0.0)),
                    Instruction::End,
                    Instruction::End,
                ]),
            ),
            // TODO: This could probably be inlined
            Self::BitwiseAnd => FuncBody::new(
                vec![],
                Instructions::new(vec![
                    Instruction::GetLocal(0),
                    Instruction::I64TruncSF64,
                    Instruction::GetLocal(1),
                    Instruction::I64TruncSF64,
                    Instruction::I64And,
                    Instruction::F64ConvertSI64,
                    Instruction::End,
                ]),
            ),
            // TODO: This could probably be inlined
            Self::BitwiseOr => FuncBody::new(
                vec![],
                Instructions::new(vec![
                    Instruction::GetLocal(0),
                    Instruction::I64TruncSF64,
                    Instruction::GetLocal(1),
                    Instruction::I64TruncSF64,
                    Instruction::I64Or,
                    Instruction::F64ConvertSI64,
                    Instruction::End,
                ]),
            ),
        }
    }
}
