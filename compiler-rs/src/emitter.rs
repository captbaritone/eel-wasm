use crate::{
    ast::{Assignment, BinaryExpression, BinaryOperator, Expression, FunctionCall, Program},
    error::CompilerError,
    index_store::IndexStore,
    shim::Shim,
    span::Span,
    EelFunctionType,
};
use parity_wasm::elements::Module;
use parity_wasm::elements::{
    CodeSection, ExportEntry, ExportSection, Func, FuncBody, FunctionSection, FunctionType,
    GlobalEntry, GlobalSection, GlobalType, ImportEntry, ImportSection, InitExpr, Internal,
    Section, Serialize, Type, TypeSection, ValueType,
};
use parity_wasm::elements::{External, Instruction, Instructions};

type EmitterResult<T> = Result<T, CompilerError>;

pub fn emit(
    programs: Vec<(String, Program, String)>,
    globals: Vec<(String, String)>,
) -> EmitterResult<Vec<u8>> {
    let mut emitter = Emitter::new();
    emitter.emit(programs, globals)
}

struct Emitter {
    current_pool: String,
    globals: IndexStore<(Option<String>, String)>,
    shims: IndexStore<Shim>,
    function_types: IndexStore<EelFunctionType>,
}

impl Emitter {
    fn new() -> Self {
        Emitter {
            current_pool: "".to_string(), // TODO: Is this okay to be empty?
            globals: Default::default(),
            function_types: Default::default(),
            shims: IndexStore::new(),
        }
    }
    fn emit(
        &mut self,
        programs: Vec<(String, Program, String)>,
        globals: Vec<(String, String)>, // (Pool name, global)
    ) -> EmitterResult<Vec<u8>> {
        let mut imports = Vec::new();

        for (pool_name, global) in globals {
            self.current_pool = pool_name;
            // TODO: Lots of clones.
            self.resolve_variable(global.clone());
            imports.push(make_import_entry(self.current_pool.clone(), global.clone()));
        }

        self.shims.get(Shim::Sin);

        let (function_exports, function_bodies, funcs) = self.emit_programs(programs, 1)?;

        for shim in self.shims.keys() {
            let type_index = self.function_types.get(shim.get_type());
            imports.push(ImportEntry::new(
                "shims".to_string(),
                shim.as_str().to_string(),
                External::Function(type_index),
            ))
        }

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
            .map_err(|err| {
                CompilerError::new(
                    format!("Module serialization error: {}", err),
                    Span::empty(),
                )
            })?;

        Ok(binary)
    }

    fn emit_type_section(&self) -> TypeSection {
        let function_types = self
            .function_types
            .keys()
            .iter()
            .map(|(args, returns)| {
                Type::Function(FunctionType::new(
                    vec![ValueType::F64; *args],
                    vec![ValueType::F64; *returns],
                ))
            })
            .collect();
        TypeSection::with_types(function_types)
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
        let globals: Vec<GlobalEntry> = self
            .globals
            .keys()
            .iter()
            .map(|_| make_empty_global())
            .collect();

        if globals.len() == 0 {
            None
        } else {
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
        programs: Vec<(String, Program, String)>,
        offset: u32,
    ) -> EmitterResult<(Vec<ExportEntry>, Vec<FuncBody>, Vec<Func>)> {
        let mut exports = Vec::new();
        let mut function_bodies = Vec::new();
        let mut function_definitions = Vec::new();
        for (i, (name, program, pool_name)) in programs.into_iter().enumerate() {
            self.current_pool = pool_name;
            exports.push(ExportEntry::new(
                name,
                Internal::Function(i as u32 + offset),
            ));
            let locals = Vec::new();
            function_bodies.push(FuncBody::new(locals, self.emit_program(program)?));

            // TODO: In the future functions should not return any values
            let function_type = self.function_types.get((0, 1));

            function_definitions.push(Func::new(function_type))
        }
        Ok((exports, function_bodies, function_definitions))
    }

    fn emit_program(&mut self, program: Program) -> EmitterResult<Instructions> {
        let mut instructions: Vec<Instruction> = Vec::new();
        for expression in program.expressions {
            self.emit_expression(expression, &mut instructions)?;
            // TODO: Consider that we might need to drop the implicit return.
        }
        instructions.push(Instruction::End);
        Ok(Instructions::new(instructions))
    }

    fn emit_expression(
        &mut self,
        expression: Expression,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        match expression {
            Expression::BinaryExpression(binary_expression) => {
                self.emit_binary_expression(binary_expression, instructions)
            }
            Expression::Assignment(assignment_expression) => {
                self.emit_assignment(assignment_expression, instructions)
            }
            Expression::NumberLiteral(number_literal) => {
                instructions.push(Instruction::F64Const(u64::from_le_bytes(
                    number_literal.value.to_le_bytes(),
                )));
                Ok(())
            }
            Expression::FunctionCall(function_call) => {
                self.emit_function_call(function_call, instructions)
            }
        }
    }

    fn emit_binary_expression(
        &mut self,
        binary_expression: BinaryExpression,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        self.emit_expression(*binary_expression.left, instructions)?;
        self.emit_expression(*binary_expression.right, instructions)?;
        let op = match binary_expression.op {
            BinaryOperator::Add => Instruction::F64Add,
            BinaryOperator::Subtract => Instruction::F64Sub,
            BinaryOperator::Multiply => Instruction::F64Mul,
            BinaryOperator::Divide => Instruction::F64Div,
        };
        instructions.push(op);
        Ok(())
    }

    fn emit_assignment(
        &mut self,
        assignment_expression: Assignment,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        let resolved_name = self.resolve_variable(assignment_expression.left.name);
        self.emit_expression(*assignment_expression.right, instructions)?;

        instructions.push(Instruction::SetGlobal(resolved_name));
        instructions.push(Instruction::GetGlobal(resolved_name));
        Ok(())
    }

    fn emit_function_call(
        &mut self,
        function_call: FunctionCall,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        let arity = function_call.arguments.len();
        for arg in function_call.arguments {
            &self.emit_expression(arg, instructions)?;
        }
        // TODO: Assert arrity
        match &function_call.name.name[..] {
            "int" => {
                instructions.push(Instruction::F64Floor);
            }
            shim_name if Shim::from_str(shim_name).is_some() => {
                let shim = Shim::from_str(shim_name).unwrap();
                if arity != shim.arity() {
                    return Err(CompilerError::new(
                        format!(
                            "Incorrect argument count for function `{}`. Expected {} but got {}.",
                            shim_name,
                            shim.arity(),
                            arity
                        ),
                        // TODO: Better to underline the argument list
                        function_call.name.span,
                    ));
                }
                instructions.push(Instruction::Call(self.shims.get(shim)));
            }
            _ => {
                return Err(CompilerError::new(
                    format!("Unknown function `{}`", function_call.name.name),
                    function_call.name.span,
                ))
            }
        }
        Ok(())
    }

    fn resolve_variable(&mut self, name: String) -> u32 {
        let pool = if variable_is_register(&name) {
            None
        } else {
            Some(self.current_pool.clone())
        };

        self.globals.get((pool, name))
    }
}

fn variable_is_register(name: &str) -> bool {
    let chars: Vec<_> = name.chars().collect();
    // We avoided pulling in the regex crate! (But at what cost?)
    matches!(chars.as_slice(), ['r', 'e', 'g', '0'..='9', '0'..='9'])
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
