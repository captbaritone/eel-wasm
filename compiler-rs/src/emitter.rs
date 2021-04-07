use parity_wasm::elements::{
    CodeSection, ExportEntry, ExportSection, Func, FuncBody, FunctionSection, FunctionType,
    Internal, Module, Section, Serialize, Type, TypeSection, ValueType,
};
use parity_wasm::elements::{Instruction, Instructions};

use crate::ast::{BinaryExpression, BinaryOperator};

use super::ast::{Expression, Program};

pub fn emit(program: Program) -> Result<Vec<u8>, String> {
    let emitter = Emitter {};
    emitter.emit(program)
}

struct Emitter {}

impl Emitter {
    fn emit(&self, program: Program) -> Result<Vec<u8>, String> {
        let mut binary: Vec<u8> = Vec::new();
        let locals = vec![];
        let instructions = self.emit_program(program)?;
        let func_body = FuncBody::new(locals, instructions);
        let code_section = CodeSection::with_bodies(vec![func_body]);

        let export_section = ExportSection::with_entries(vec![ExportEntry::new(
            "test".to_string(),
            Internal::Function(0),
        )]);

        let params = vec![];
        let results = vec![ValueType::F64];

        let type_section =
            TypeSection::with_types(vec![Type::Function(FunctionType::new(params, results))]);
        let function_section = FunctionSection::with_entries(vec![Func::new(0)]);

        let module = Module::new(vec![
            Section::Type(type_section),
            Section::Function(function_section),
            Section::Export(export_section),
            Section::Code(code_section),
        ]);
        module
            .serialize(&mut binary)
            .map_err(|err| format!("Serialization Error: {}", err))?;

        Ok(binary)
    }

    fn emit_program(&self, program: Program) -> Result<Instructions, String> {
        let expression_instructions = self.emit_expression(program.expression)?;
        let mut new = Vec::with_capacity(expression_instructions.len() + 1);
        new.extend_from_slice(&expression_instructions);
        new.push(Instruction::End);
        Ok(Instructions::new(new))
    }

    fn emit_expression(&self, expression: Expression) -> Result<Vec<Instruction>, String> {
        match expression {
            Expression::BinaryExpression(binary_expression) => {
                self.emit_binary_expression(binary_expression)
            }
            Expression::NumberLiteral(number_literal) => Ok(vec![Instruction::F64Const(
                u64::from_le_bytes(number_literal.value.to_le_bytes()),
            )]),
        }
    }

    fn emit_binary_expression(
        &self,
        binary_expression: BinaryExpression,
    ) -> Result<Vec<Instruction>, String> {
        let left = self.emit_expression(*binary_expression.left)?;
        let right = self.emit_expression(*binary_expression.right)?;
        let op = match binary_expression.op {
            BinaryOperator::Add => Instruction::F64Add,
            BinaryOperator::Subtract => Instruction::F64Sub,
            BinaryOperator::Multiply => Instruction::F64Mul,
            BinaryOperator::Divide => Instruction::F64Div,
        };
        let mut instructions = Vec::with_capacity(left.len() + right.len() + 1);
        instructions.extend_from_slice(&left);
        instructions.extend_from_slice(&right);
        instructions.push(op);
        Ok(instructions)
    }
}
