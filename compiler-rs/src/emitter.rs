use std::collections::{HashMap, HashSet};

use crate::{
    ast::{
        Assignment, BinaryExpression, BinaryOperator, EelFunction, Expression, FunctionCall,
        UnaryExpression, UnaryOperator,
    },
    builtin_functions::BuiltinFunction,
    error::CompilerError,
    index_store::IndexStore,
    shim::Shim,
    span::Span,
    EelFunctionType,
};
use parity_wasm::elements::{
    CodeSection, ExportEntry, ExportSection, External, Func, FuncBody, FunctionSection,
    FunctionType, GlobalEntry, GlobalSection, GlobalType, ImportEntry, ImportSection, InitExpr,
    Instruction, Instructions, Internal, Module, Section, Serialize, Type, TypeSection, ValueType,
};

type EmitterResult<T> = Result<T, CompilerError>;

static EPSILON: f64 = 0.00001;

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

        self.builtin_offset = Some(eel_functions.len() as u32 + imports.len() as u32);

        let (function_exports, function_bodies, funcs) =
            self.emit_eel_functions(eel_functions, imports.len() as u32)?;

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

    fn emit_program(&mut self, program: EelFunction) -> EmitterResult<Instructions> {
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
                    Instruction::F32Abs,
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

    fn resolve_builtin_function(&mut self, builtin: BuiltinFunction) -> u32 {
        self.function_types.ensure(builtin.get_type());
        let offset = self
            .builtin_offset
            .expect("Tried to compute builtin index before setting offset.");
        self.builtin_functions.get(builtin) + offset
    }
}

// TODO: There's got to be a better way.
fn f64_const(value: f64) -> u64 {
    u64::from_le_bytes(value.to_le_bytes())
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
