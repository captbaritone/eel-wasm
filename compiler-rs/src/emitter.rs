use std::{
    collections::{HashMap, HashSet},
    mem,
};

use crate::{
    ast::{
        Assignment, BinaryExpression, BinaryOperator, EelFunction, Expression, ExpressionBlock,
        FunctionCall, UnaryExpression, UnaryOperator,
    },
    builtin_functions::BuiltinFunction,
    constants::{BUFFER_SIZE, EPSILON, WASM_MEMORY_SIZE},
    error::CompilerError,
    index_store::IndexStore,
    shim::Shim,
    span::Span,
    utils::f64_const,
    EelFunctionType,
};
use parity_wasm::elements::{
    BlockType, CodeSection, ExportEntry, ExportSection, External, Func, FuncBody, FunctionSection,
    FunctionType, GlobalEntry, GlobalSection, GlobalType, ImportEntry, ImportSection, InitExpr,
    Instruction, Instructions, Internal, Local, MemorySection, MemoryType, Module, Section,
    Serialize, Type, TypeSection, ValueType,
};

type EmitterResult<T> = Result<T, CompilerError>;

pub fn emit(
    eel_functions: Vec<(String, EelFunction, String)>,
    globals_map: HashMap<String, HashSet<String>>,
) -> EmitterResult<Vec<u8>> {
    let mut emitter = Emitter::new();
    emitter.emit(eel_functions, globals_map)
}

struct Emitter {
    current_pool: String,
    globals: IndexStore<(Option<String>, String)>,
    shims: IndexStore<Shim>,
    builtin_functions: IndexStore<BuiltinFunction>,
    function_types: IndexStore<EelFunctionType>,
    builtin_offset: Option<u32>,
    locals: Vec<ValueType>,
}

impl Emitter {
    fn new() -> Self {
        Emitter {
            current_pool: "".to_string(), // TODO: Is this okay to be empty?
            globals: Default::default(),
            shims: IndexStore::new(),
            function_types: Default::default(),
            builtin_functions: IndexStore::new(),
            builtin_offset: None,
            locals: Default::default(),
        }
    }
    fn emit(
        &mut self,
        eel_functions: Vec<(String, EelFunction, String)>,
        globals_map: HashMap<String, HashSet<String>>, // HahsMap<pool, HashSet<global>>
    ) -> EmitterResult<Vec<u8>> {
        let mut imports = Vec::new();

        for (pool_name, globals) in globals_map {
            self.current_pool = pool_name;
            for global in globals {
                // TODO: Lots of clones.
                self.resolve_variable(global.clone());
                imports.push(make_import_entry(self.current_pool.clone(), global.clone()));
            }
        }

        let shims: Vec<Shim> = vec![Shim::Sin];
        let shim_offset = shims.len() as u32;
        for shim in shims {
            let field_str = shim.as_str().to_string();
            let type_ = shim.get_type();
            self.shims.ensure(shim);
            imports.push(ImportEntry::new(
                "shims".to_string(),
                field_str,
                External::Function(self.function_types.get(type_)),
            ));
        }

        self.builtin_offset = Some(eel_functions.len() as u32 + shim_offset);

        let (function_exports, function_bodies, funcs) =
            self.emit_eel_functions(eel_functions, shim_offset)?;

        let mut sections = vec![];
        sections.push(Section::Type(self.emit_type_section()));
        if let Some(import_section) = self.emit_import_section(imports) {
            sections.push(Section::Import(import_section));
        }
        sections.push(Section::Function(self.emit_function_section(funcs)));

        sections.push(Section::Memory(MemorySection::with_entries(vec![
            MemoryType::new(WASM_MEMORY_SIZE, Some(WASM_MEMORY_SIZE)),
        ])));

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
            .into_iter()
            .map(|function_type| {
                Type::Function(FunctionType::new(
                    // TODO: This is clone with more steps. What's going on
                    function_type.params().to_vec(),
                    function_type.results().to_vec(),
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

    fn emit_function_section(&mut self, funcs: Vec<Func>) -> FunctionSection {
        let mut entries = funcs.clone();
        for builtin in self.builtin_functions.keys() {
            let type_idx = self.function_types.get(builtin.get_type());
            entries.push(Func::new(type_idx));
        }
        FunctionSection::with_entries(entries)
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
        // TODO: Avoid this clone
        let mut bodies = function_bodies.clone();
        for builtin in self.builtin_functions.keys() {
            bodies.push(builtin.func_body());
        }
        CodeSection::with_bodies(bodies)
    }

    fn emit_eel_functions(
        &mut self,
        eel_functions: Vec<(String, EelFunction, String)>,
        offset: u32,
    ) -> EmitterResult<(Vec<ExportEntry>, Vec<FuncBody>, Vec<Func>)> {
        let mut exports = Vec::new();
        let mut function_bodies = Vec::new();
        let mut function_definitions = Vec::new();
        for (i, (name, program, pool_name)) in eel_functions.into_iter().enumerate() {
            // Note: We assume self.locals has been rest during the previous run.
            self.current_pool = pool_name;
            exports.push(ExportEntry::new(
                name,
                Internal::Function(i as u32 + offset),
            ));

            let instructions = self.emit_program(program)?;

            let local_types = mem::replace(&mut self.locals, Vec::new());

            let locals = local_types
                .into_iter()
                .map(|type_| Local::new(1, type_))
                .collect();

            function_bodies.push(FuncBody::new(locals, instructions));

            let function_type = self.function_types.get(FunctionType::new(vec![], vec![]));

            function_definitions.push(Func::new(function_type))
        }
        Ok((exports, function_bodies, function_definitions))
    }

    fn emit_program(&mut self, eel_function: EelFunction) -> EmitterResult<Instructions> {
        let mut instructions: Vec<Instruction> = Vec::new();
        self.emit_expression_block(eel_function.expressions, &mut instructions)?;
        instructions.push(Instruction::Drop);
        instructions.push(Instruction::End);
        Ok(Instructions::new(instructions))
    }

    fn emit_expression_block(
        &mut self,
        block: ExpressionBlock,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        let last_index = block.expressions.len() - 1;
        for (i, expression) in block.expressions.into_iter().enumerate() {
            self.emit_expression(expression, instructions)?;
            if i != last_index {
                instructions.push(Instruction::Drop)
            }
        }
        Ok(())
    }

    fn emit_expression(
        &mut self,
        expression: Expression,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        match expression {
            Expression::UnaryExpression(unary_expression) => {
                self.emit_unary_expression(unary_expression, instructions)
            }
            Expression::BinaryExpression(binary_expression) => {
                self.emit_binary_expression(binary_expression, instructions)
            }
            Expression::Assignment(assignment_expression) => {
                self.emit_assignment(assignment_expression, instructions)
            }
            Expression::NumberLiteral(number_literal) => {
                instructions.push(Instruction::F64Const(f64_const(number_literal.value)));
                Ok(())
            }
            Expression::FunctionCall(function_call) => {
                self.emit_function_call(function_call, instructions)
            }
            Expression::ExpressionBlock(expression_block) => {
                self.emit_expression_block(expression_block, instructions)
            }
            Expression::Identifier(identifier) => {
                let index = self.resolve_variable(identifier.name);
                instructions.push(Instruction::GetGlobal(index));
                Ok(())
            }
        }
    }

    fn emit_unary_expression(
        &mut self,
        unary_expression: UnaryExpression,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        match unary_expression.op {
            UnaryOperator::Plus => self.emit_expression(*unary_expression.right, instructions),
            UnaryOperator::Minus => {
                self.emit_expression(*unary_expression.right, instructions)?;
                instructions.push(Instruction::F64Neg);
                Ok(())
            }
            UnaryOperator::Not => {
                self.emit_expression(*unary_expression.right, instructions)?;
                instructions.extend(vec![
                    Instruction::F64Abs,
                    Instruction::F64Const(f64_const(EPSILON)),
                    Instruction::F64Lt,
                ]);
                instructions.push(Instruction::F64ConvertSI32);
                Ok(())
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
            BinaryOperator::Divide => {
                Instruction::Call(self.resolve_builtin_function(BuiltinFunction::Div))
            }
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
        mut function_call: FunctionCall,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        match &function_call.name.name[..] {
            "int" => {
                assert_arity(&function_call, 1)?;
                for arg in function_call.arguments {
                    self.emit_expression(arg, instructions)?;
                }
                instructions.push(Instruction::F64Floor);
            }
            "if" => {
                assert_arity(&function_call, 3)?;

                let alternate = function_call.arguments.pop().unwrap();
                let consiquent = function_call.arguments.pop().unwrap();
                let test = function_call.arguments.pop().unwrap();

                self.emit_expression(test, instructions)?;
                emit_is_not_zeroish(instructions);
                instructions.push(Instruction::If(BlockType::Value(ValueType::F64)));
                self.emit_expression(consiquent, instructions)?;
                instructions.push(Instruction::Else);
                self.emit_expression(alternate, instructions)?;
                instructions.push(Instruction::End);
            }
            "megabuf" => self.emit_memory_access(&mut function_call, 0, instructions)?,
            "gmegabuf" => {
                self.emit_memory_access(&mut function_call, BUFFER_SIZE * 8, instructions)?
            }
            shim_name if Shim::from_str(shim_name).is_some() => {
                let shim = Shim::from_str(shim_name).unwrap();
                assert_arity(&function_call, shim.arity())?;

                for arg in function_call.arguments {
                    self.emit_expression(arg, instructions)?;
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

    fn emit_memory_access(
        &mut self,
        function_call: &mut FunctionCall,
        memory_offset: u32,
        instructions: &mut Vec<Instruction>,
    ) -> EmitterResult<()> {
        assert_arity(&function_call, 1)?;
        let index = self.resolve_local(ValueType::I32);
        self.emit_expression(function_call.arguments.pop().unwrap(), instructions)?;
        instructions.push(Instruction::Call(
            self.resolve_builtin_function(BuiltinFunction::GetBufferIndex),
        ));
        //
        instructions.push(Instruction::TeeLocal(index));
        instructions.push(Instruction::I32Const(-1));
        instructions.push(Instruction::I32Ne);
        // STACK: [in range]
        instructions.push(Instruction::If(BlockType::Value(ValueType::F64)));
        instructions.push(Instruction::GetLocal(index));
        instructions.push(Instruction::F64Load(3, memory_offset));
        instructions.push(Instruction::Else);
        instructions.push(Instruction::F64Const(f64_const(0.0)));
        instructions.push(Instruction::End);

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

    fn resolve_local(&mut self, type_: ValueType) -> u32 {
        self.locals.push(type_);
        return self.locals.len() as u32 - 1;
    }

    fn resolve_builtin_function(&mut self, builtin: BuiltinFunction) -> u32 {
        self.function_types.ensure(builtin.get_type());
        let offset = self
            .builtin_offset
            .expect("Tried to compute builtin index before setting offset.");
        self.builtin_functions.get(builtin) + offset
    }
}

fn emit_is_not_zeroish(instructions: &mut Vec<Instruction>) {
    instructions.push(Instruction::F64Abs);
    instructions.push(Instruction::F64Const(f64_const(EPSILON)));
    instructions.push(Instruction::F64Gt);
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
            Instruction::F64Const(f64_const(0.0)),
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

fn assert_arity(function_call: &FunctionCall, arity: usize) -> EmitterResult<()> {
    if function_call.arguments.len() != arity {
        Err(CompilerError::new(
            format!(
                "Incorrect argument count for function `{}`. Expected {} but got {}.",
                function_call.name.name,
                arity,
                function_call.arguments.len()
            ),
            // TODO: Better to underline the argument list
            function_call.name.span,
        ))
    } else {
        Ok(())
    }
}
