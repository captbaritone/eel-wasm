use std::collections::{hash_map::Entry, HashMap};

use parity_wasm::elements::{
    CodeSection, ExportEntry, ExportSection, Func, FuncBody, FunctionSection, FunctionType,
    GlobalEntry, GlobalSection, GlobalType, InitExpr, Internal, Module, Section, Serialize, Type,
    TypeSection, ValueType,
};
use parity_wasm::elements::{Instruction, Instructions};

use crate::ast::{Assignment, BinaryExpression, BinaryOperator};

use super::ast::{Expression, Program};

pub fn emit(program: Program) -> Result<Vec<u8>, String> {
    let mut emitter = Emitter::new();
    emitter.emit(program)
}

struct Emitter {
    globals: HashMap<String, u32>,
}

impl Emitter {
    fn new() -> Self {
        Emitter {
            globals: HashMap::default(),
        }
    }
    fn emit(&mut self, program: Program) -> Result<Vec<u8>, String> {
        let instructions = self.emit_program(program)?;

        let mut sections = vec![];
        sections.push(Section::Type(self.emit_type_section()));
        sections.push(Section::Function(self.emit_function_section()));
        if let Some(global_section) = self.emit_global_section() {
            sections.push(Section::Global(global_section));
        }
        sections.push(Section::Export(self.emit_export_section()));
        sections.push(Section::Code(self.emit_code_section(instructions)));

        let mut binary: Vec<u8> = Vec::new();
        Module::new(sections)
            .serialize(&mut binary)
            .map_err(|err| format!("Module serialization error: {}", err))?;

        Ok(binary)
    }

    fn emit_type_section(&self) -> TypeSection {
        let params = vec![];
        let results = vec![ValueType::F64];
        TypeSection::with_types(vec![Type::Function(FunctionType::new(params, results))])
    }

    fn emit_function_section(&self) -> FunctionSection {
        FunctionSection::with_entries(vec![Func::new(0)])
    }

    fn emit_global_section(&self) -> Option<GlobalSection> {
        // TODO: Derive this from seen globals
        if self.globals.len() == 0 {
            None
        } else {
            let mut globals = vec![];
            let mut globals_left = self.globals.len();
            while globals_left > 0 {
                globals.push(make_empty_global());
                globals_left -= 1;
            }

            Some(GlobalSection::with_entries(globals))
        }
    }

    fn emit_export_section(&self) -> ExportSection {
        ExportSection::with_entries(vec![ExportEntry::new(
            "test".to_string(),
            Internal::Function(0),
        )])
    }

    fn emit_code_section(&self, instructions: Instructions) -> CodeSection {
        let locals = vec![];
        let func_body = FuncBody::new(locals, instructions);
        CodeSection::with_bodies(vec![func_body])
    }

    fn emit_program(&mut self, program: Program) -> Result<Instructions, String> {
        let mut instructions: Vec<Instruction> = Vec::new();
        for expression in program.expressions {
            let expression_instructions = self.emit_expression(expression)?;
            instructions.extend_from_slice(&expression_instructions);
            // TODO: Consider that we might need to drop the implicit return.
        }
        let mut new = Vec::with_capacity(instructions.len() + 1);
        new.extend_from_slice(&instructions);
        new.push(Instruction::End);
        Ok(Instructions::new(new))
    }

    fn emit_expression(&mut self, expression: Expression) -> Result<Vec<Instruction>, String> {
        match expression {
            Expression::BinaryExpression(binary_expression) => {
                self.emit_binary_expression(binary_expression)
            }
            Expression::Assignment(assignment_expression) => {
                self.emit_assignment(assignment_expression)
            }
            Expression::NumberLiteral(number_literal) => Ok(vec![Instruction::F64Const(
                u64::from_le_bytes(number_literal.value.to_le_bytes()),
            )]),
        }
    }

    fn emit_binary_expression(
        &mut self,
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

    fn emit_assignment(
        &mut self,
        assignment_expression: Assignment,
    ) -> Result<Vec<Instruction>, String> {
        let mut instructions: Vec<Instruction> = Vec::new();
        let resolved_name = self.resolve_variable(assignment_expression.left.name);
        let right_expression = self.emit_expression(*assignment_expression.right)?;

        instructions.extend_from_slice(&right_expression);

        instructions.push(Instruction::SetGlobal(resolved_name));
        instructions.push(Instruction::GetGlobal(resolved_name));
        Ok(instructions)
    }

    fn resolve_variable(&mut self, name: String) -> u32 {
        let next = self.globals.len() as u32;
        match self.globals.entry(name) {
            Entry::Occupied(entry) => entry.get().clone(),
            Entry::Vacant(entry) => {
                entry.insert(next);
                next
            }
        }
    }
}

fn make_empty_global() -> GlobalEntry {
    GlobalEntry::new(
        GlobalType::new(ValueType::F64, true),
        InitExpr::new(vec![
            Instruction::F64Const(
                // TODO: Get the correct bits here
                0,
            ),
            Instruction::End,
        ]),
    )
}
