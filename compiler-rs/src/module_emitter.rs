use crate::emitter_context::{EmitterContext, ModuleFunction};
use std::collections::{HashMap, HashSet};

use crate::{
    ast::EelFunction,
    constants::WASM_MEMORY_SIZE,
    error::{CompilerError, EmitterResult},
    function_emitter::emit_function,
    shim::Shim,
    span::Span,
    utils::f64_const,
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
    context: EmitterContext,
}

impl Emitter {
    fn new() -> Self {
        Emitter {
            context: EmitterContext::new(),
        }
    }
    fn emit(
        &mut self,
        eel_functions: Vec<(String, EelFunction, String)>,
        globals_map: HashMap<String, HashSet<String>>, // HahsMap<pool, HashSet<global>>
    ) -> EmitterResult<Vec<u8>> {
        let mut imports = Vec::new();

        for (pool_name, globals) in globals_map {
            self.context.current_pool = pool_name;
            for global in globals {
                // TODO: Ensure none of these are `ref\d\d`
                // TODO: Lots of clones.
                self.context.resolve_variable(global.clone());
                imports.push(make_import_entry(
                    self.context.current_pool.clone(),
                    global.clone(),
                ));
            }
        }

        let shims: Vec<Shim> = vec![
            Shim::Sin,
            Shim::Pow,
            Shim::Cos,
            Shim::Tan,
            Shim::Asin,
            Shim::Acos,
            Shim::Atan,
            Shim::Atan2,
            Shim::Log,
            Shim::Log10,
            Shim::Sigmoid,
            Shim::Exp,
        ];
        for shim in shims {
            let field_str = shim.as_str().to_string();
            let type_ = shim.get_type();
            self.context.resolve_shim_function(shim);
            imports.push(ImportEntry::new(
                "shims".to_string(),
                field_str,
                External::Function(self.context.function_types.get(type_)),
            ));
        }

        let (function_exports, function_bodies, funcs) = self.emit_eel_functions(eel_functions)?;

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
            .context
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
        let mut entries = Vec::new();
        for module_function in self.context.functions.keys() {
            let func = match module_function {
                ModuleFunction::Shim(_) => None,
                ModuleFunction::Builtin(builtin) => {
                    let type_idx = self.context.function_types.get(builtin.get_type());
                    Some(Func::new(type_idx))
                }
                ModuleFunction::Eel(func_idx) => Some(funcs.get(*func_idx).unwrap().clone()),
            };
            if let Some(func) = func {
                entries.push(func);
            }
        }
        FunctionSection::with_entries(entries)
    }

    fn emit_global_section(&self) -> Option<GlobalSection> {
        let globals: Vec<GlobalEntry> = self
            .context
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
        let mut bodies = Vec::new();
        for module_function in self.context.functions.keys() {
            let body = match module_function {
                ModuleFunction::Shim(_) => None,
                ModuleFunction::Builtin(builtin) => Some(builtin.func_body()),
                ModuleFunction::Eel(func_idx) => {
                    // TODO: Avoid this clone
                    Some(function_bodies.get(*func_idx).unwrap().clone())
                }
            };
            if let Some(body) = body {
                bodies.push(body);
            }
        }
        CodeSection::with_bodies(bodies)
    }

    fn emit_eel_functions(
        &mut self,
        eel_functions: Vec<(String, EelFunction, String)>,
    ) -> EmitterResult<(Vec<ExportEntry>, Vec<FuncBody>, Vec<Func>)> {
        let mut exports = Vec::new();
        let mut function_bodies = Vec::new();
        let mut function_definitions = Vec::new();
        for (i, (name, program, pool_name)) in eel_functions.into_iter().enumerate() {
            let function_idx = self.context.resolve_eel_function(i);
            self.context.current_pool = pool_name;
            let function_body = emit_function(program, &mut self.context)?;

            function_bodies.push(function_body);

            exports.push(ExportEntry::new(name, Internal::Function(function_idx)));

            let function_type = self
                .context
                .function_types
                .get(FunctionType::new(vec![], vec![]));

            function_definitions.push(Func::new(function_type))
        }
        Ok((exports, function_bodies, function_definitions))
    }
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
