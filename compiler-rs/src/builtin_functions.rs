use parity_wasm::elements::{
    BlockType, FuncBody, FunctionType, Instruction, Instructions, Local, ValueType,
};

use crate::utils::f64_const;
use crate::EelFunctionType;
use crate::{
    constants::{BUFFER_SIZE, EPSILON},
    emitter_context::EmitterContext,
};

#[derive(PartialEq, Eq, Hash)]
pub enum BuiltinFunction {
    Div,
    Mod,
    GetBufferIndex,
    LogicalOr,
    LogicalAnd,
    BitwiseAnd,
    BitwiseOr,
    Sqr,
    Sign,
}

impl BuiltinFunction {
    pub fn get_type(&self) -> EelFunctionType {
        FunctionType::new(vec![ValueType::F64; self.arity()], vec![self.return_type()])
    }

    pub fn return_type(&self) -> ValueType {
        match self {
            Self::GetBufferIndex => ValueType::I32,
            _ => ValueType::F64,
        }
    }

    fn arity(&self) -> usize {
        match self {
            Self::Div => 2,
            Self::GetBufferIndex => 1,
            Self::Mod => 2,
            Self::BitwiseAnd => 2,
            Self::BitwiseOr => 2,
            Self::LogicalAnd => 2,
            Self::LogicalOr => 2,
            Self::Sqr => 1,
            Self::Sign => 1,
        }
    }

    pub fn func_body(&self, _context: &EmitterContext) -> FuncBody {
        match self {
            Self::Sign => FuncBody::new(
                vec![],
                Instructions::new(vec![
                    Instruction::F64Const(f64_const(0.0)),
                    Instruction::GetLocal(0),
                    Instruction::F64Lt,
                    Instruction::GetLocal(0),
                    Instruction::F64Const(f64_const(0.0)),
                    Instruction::F64Lt,
                    Instruction::I32Sub,
                    Instruction::F64ConvertSI32,
                    Instruction::End,
                ]),
            ),
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
            Self::Sqr => FuncBody::new(
                vec![],
                Instructions::new(vec![
                    Instruction::GetLocal(0),
                    Instruction::GetLocal(0),
                    Instruction::F64Mul,
                    Instruction::End,
                ]),
            ),
            Self::LogicalAnd => FuncBody::new(
                vec![],
                Instructions::new(vec![
                    Instruction::GetLocal(0),
                    // is not zeroish
                    Instruction::F64Abs,
                    Instruction::F64Const(f64_const(EPSILON)),
                    Instruction::F64Gt,
                    // end is not zeroish
                    Instruction::GetLocal(1),
                    // is not zeroish
                    Instruction::F64Abs,
                    Instruction::F64Const(f64_const(EPSILON)),
                    Instruction::F64Gt,
                    // end is not zeroish
                    Instruction::I32And,
                    Instruction::I32Const(0),
                    Instruction::I32Ne,
                    Instruction::F64ConvertSI32,
                    Instruction::End,
                ]),
            ),
            Self::LogicalOr => FuncBody::new(
                vec![],
                Instructions::new(vec![
                    Instruction::GetLocal(0),
                    // is not zeroish
                    Instruction::F64Abs,
                    Instruction::F64Const(f64_const(EPSILON)),
                    Instruction::F64Gt,
                    // end is not zeroish
                    Instruction::GetLocal(1),
                    // is not zeroish
                    Instruction::F64Abs,
                    Instruction::F64Const(f64_const(EPSILON)),
                    Instruction::F64Gt,
                    // end is not zeroish
                    Instruction::I32Or,
                    Instruction::I32Const(0),
                    Instruction::I32Ne,
                    Instruction::F64ConvertSI32,
                    Instruction::End,
                ]),
            ),
        }
    }
}
