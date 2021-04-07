use super::ast::{Expression, Program};
use crate::ast::{Assignment, BinaryExpression, BinaryOperator, FunctionCall};
use parity_wasm::elements::Module;
use parity_wasm::elements::{
    CodeSection, ExportEntry, ExportSection, Func, FuncBody, FunctionSection, FunctionType,
    GlobalEntry, GlobalSection, GlobalType, ImportEntry, ImportSection, InitExpr, Internal,
    Section, Serialize, Type, TypeSection, ValueType,
};
use parity_wasm::elements::{External, Instruction, Instructions};
use std::collections::{hash_map::Entry, HashMap};

type EmitterResult<T> = Result<T, String>;

pub fn emit(programs: Vec<(String, Program)>, globals: Vec<String>) -> Result<Vec<u8>, String> {
    let mut emitter = Emitter::new();
    emitter.emit(programs, globals)
}

struct Emitter {
    current_pool: String,
    globals: HashMap<String, u32>,
}

impl Emitter {
    fn new() -> Self {
        Emitter {
            current_pool: "".to_string(), // TODO: Is this okay to be empty?
            globals: HashMap::default(),
        }
    }
    fn emit(
        &mut self,
        programs: Vec<(String, Program)>,
        globals: Vec<String>,
    ) -> EmitterResult<Vec<u8>> {
        let mut imports = Vec::new();

        self.current_pool = "pool".to_string();
        for global in &globals {
            // TODO: Lots of clones.
            self.resolve_variable(global.clone());
            imports.push(make_import_entry(self.current_pool.clone(), global.clone()));
        }

        let (function_exports, function_bodies, funcs) = self.emit_programs(programs)?;

        let mut sections = vec![];
        sections.push(Section::Type(self.emit_type_section()));
        if let Some(import_section) = self.emit_import_section(imports) {
            sections.push(Section::Import(import_section));
        }
        sections.push(Section::Function(self.emit_function_section(funcs)));
        if let Some(global_section) = self.emit_global_section() {
            sections.push(Section::Global(global_section));
        }
        sections.push(Section::Export(self.emit_export_section(function_exports)));
        sections.push(Section::Code(self.emit_code_section(function_bodies)));

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

    fn emit_import_section(&self, imports: Vec<ImportEntry>) -> Option<ImportSection> {
        if imports.len() > 0 {
            Some(ImportSection::with_entries(imports))
        } else {
            None
        }
    }

    fn emit_function_section(&self, funcs: Vec<Func>) -> FunctionSection {
        FunctionSection::with_entries(funcs)
    }

    fn emit_global_section(&self) -> Option<GlobalSection> {
        // TODO: Derive this from seen globals
        if self.globals.len() == 0 {
            None
        } else {
            let globals = [0..self.globals.len()]
                .iter()
                .map(|_| make_empty_global())
                .collect();

            Some(GlobalSection::with_entries(globals))
        }
    }

    fn emit_export_section(&self, function_exports: Vec<ExportEntry>) -> ExportSection {
        ExportSection::with_entries(function_exports)
    }

    fn emit_code_section(&self, function_bodies: Vec<FuncBody>) -> CodeSection {
        CodeSection::with_bodies(function_bodies)
    }

    fn emit_programs(
        &mut self,
        programs: Vec<(String, Program)>,
    ) -> EmitterResult<(Vec<ExportEntry>, Vec<FuncBody>, Vec<Func>)> {
        let mut names = Vec::new();
        let mut instructions = Vec::new();
        let mut funcs = Vec::new();
        for (i, (name, program)) in programs.into_iter().enumerate() {
            names.push(ExportEntry::new(name, Internal::Function(i as u32)));
            let locals = Vec::new();
            let func_body = FuncBody::new(locals, self.emit_program(program)?);
            instructions.push(func_body);

            funcs.push(Func::new(0))
        }
        Ok((names, instructions, funcs))
    }

    fn emit_program(&mut self, program: Program) -> EmitterResult<Instructions> {
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

    fn emit_expression(&mut self, expression: Expression) -> EmitterResult<Vec<Instruction>> {
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
            Expression::FunctionCall(function_call) => self.emit_function_call(function_call),
        }
    }

    fn emit_binary_expression(
        &mut self,
        binary_expression: BinaryExpression,
    ) -> EmitterResult<Vec<Instruction>> {
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
    ) -> EmitterResult<Vec<Instruction>> {
        let mut instructions: Vec<Instruction> = Vec::new();
        let resolved_name = self.resolve_variable(assignment_expression.left.name);
        let right_expression = self.emit_expression(*assignment_expression.right)?;

        instructions.extend_from_slice(&right_expression);

        instructions.push(Instruction::SetGlobal(resolved_name));
        instructions.push(Instruction::GetGlobal(resolved_name));
        Ok(instructions)
    }

    fn emit_function_call(
        &mut self,
        function_call: FunctionCall,
    ) -> EmitterResult<Vec<Instruction>> {
        match &function_call.name.name[..] {
            "int" => {
                let mut instructions = vec![];
                for arg in function_call.arguments {
                    instructions.extend_from_slice(&self.emit_expression(arg)?);
                }
                instructions.push(Instruction::F64Floor);
                Ok(instructions)
            }
            _ => Err(format!("Unknown function `{}`", function_call.name.name)),
        }
    }

    fn resolve_variable(&mut self, name: String) -> u32 {
        let next = self.globals.len() as u32;
        match self
            .globals
            .entry(format!("{}::{}", self.current_pool, &name)) // TODO: Can we avoid this format?
        {
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

fn make_import_entry(module_str: String, field_str: String) -> ImportEntry {
    ImportEntry::new(
        module_str,
        field_str,
        External::Global(GlobalType::new(ValueType::F64, true)),
    )
}
