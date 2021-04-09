use crate::{
    builtin_functions::BuiltinFunction, index_store::IndexStore, shim::Shim, EelFunctionType,
};

#[derive(PartialEq, Eq, Hash)]
pub enum ModuleFunction {
    Shim(Shim),
    Builtin(BuiltinFunction),
    Eel(usize),
}

pub struct EmitterContext {
    pub current_pool: String,
    pub globals: IndexStore<(Option<String>, String)>,
    pub functions: IndexStore<ModuleFunction>,
    pub function_types: IndexStore<EelFunctionType>,
}

impl EmitterContext {
    pub fn new() -> Self {
        Self {
            current_pool: "".to_string(), // TODO: Is this okay to be empty?
            globals: Default::default(),
            function_types: Default::default(),
            functions: IndexStore::new(),
        }
    }
    pub fn resolve_variable(&mut self, name: String) -> u32 {
        let pool = if variable_is_register(&name) {
            None
        } else {
            Some(self.current_pool.clone())
        };

        self.globals.get((pool, name))
    }

    pub fn resolve_shim_function(&mut self, shim: Shim) -> u32 {
        self.function_types.ensure(shim.get_type());
        self.functions.get(ModuleFunction::Shim(shim))
    }

    pub fn resolve_builtin_function(&mut self, builtin: BuiltinFunction) -> u32 {
        self.function_types.ensure(builtin.get_type());
        self.functions.get(ModuleFunction::Builtin(builtin))
    }

    pub fn resolve_eel_function(&mut self, idx: usize) -> u32 {
        self.functions.get(ModuleFunction::Eel(idx))
    }
}

fn variable_is_register(name: &str) -> bool {
    let chars: Vec<_> = name.chars().collect();
    // We avoided pulling in the regex crate! (But at what cost?)
    matches!(chars.as_slice(), ['r', 'e', 'g', '0'..='9', '0'..='9'])
}
