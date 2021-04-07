use std::collections::{HashMap, HashSet};

use crate::{
    ast::EelFunction,
    builtin_functions::BuiltinFunction,
    constants::WASM_MEMORY_SIZE,
    error::{CompilerError, EmitterResult},
    function_emitter::emit_function,
    index_store::IndexStore,
    shim::Shim,
    span::Span,
    utils::f64_const,
    EelFunctionType,
};
use parity_wasm::elements::{
    CodeSection, ExportEntry, ExportSection, External, Func, FuncBody, FunctionSection,
    FunctionType, GlobalEntry, GlobalSection, GlobalType, ImportEntry, ImportSection, InitExpr,
    Instruction, Internal, MemorySection, MemoryType, Module, Section, Serialize, Type,
    TypeSection, ValueType,
};

pub fn emit_module(
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
            let function_body = emit_function(
                program,
                pool_name,
                &mut self.globals,
                &mut self.shims,
                &mut self.builtin_functions,
                &mut self.function_types,
                &self.builtin_offset,
            )?;

            function_bodies.push(function_body);

            exports.push(ExportEntry::new(
                name,
                Internal::Function(i as u32 + offset),
            ));

            let function_type = self.function_types.get(FunctionType::new(vec![], vec![]));

            function_definitions.push(Func::new(function_type))
        }
        Ok((exports, function_bodies, function_definitions))
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
