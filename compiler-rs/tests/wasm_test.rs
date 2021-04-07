extern crate wabt;
extern crate wasmi;

use std::error::Error;

use wasmi::{
    nan_preserving_float::F64, GlobalDescriptor, GlobalInstance, GlobalRef, ImportResolver,
    ImportsBuilder,
};
use wasmi::{
    Error as InterpreterError, ModuleImportResolver, ModuleInstance, ModuleRef, NopExternals,
    RuntimeValue,
};

use parity_wasm::{
    builder::{from_module, module},
    elements::{
        BlockType, External, GlobalEntry, GlobalType, ImportEntry, InitExpr, Instruction,
        Instructions, MemoryType, Module, TableType, ValueType,
    },
};

struct SpecModule {
    g: GlobalRef,
}

impl SpecModule {
    fn new() -> Self {
        SpecModule {
            g: GlobalInstance::alloc(RuntimeValue::F64(666.0.into()), false),
        }
    }
}

impl ModuleImportResolver for SpecModule {
    fn resolve_global(
        &self,
        field_name: &str,
        _global_type: &GlobalDescriptor,
    ) -> Result<GlobalRef, InterpreterError> {
        panic!("Filed name");
        Ok(GlobalInstance::alloc(RuntimeValue::F64(1.0.into()), false))
    }
}

// #[test]
fn wasm_test() {
    // Parse WAT (WebAssembly Text format) into wasm bytecode.
    let wasm_binary: Vec<u8> = wabt::wat2wasm(
        r#"
            (module
                (import "main" "foo" (global (;0;) (mut f64)))
                (func (export "test") (result f64)
                    f64.const 69
                    set_global 0
                    f64.const 1
                )
            )
            "#,
    )
    .expect("failed to parse wat");
    // Load wasm binary and prepare it for instantiation.
    let module = wasmi::Module::from_buffer(&wasm_binary).expect("failed to load wasm");
    /*

    let mut imports = ImportsBuilder::default();
    let main = SpecModule::new();
    imports.push_resolver("main", &main);

    // Instantiate a module with empty imports and
    // assert that there is no `start` function.
    let instance = ModuleInstance::new(&module, &imports)
        .expect("failed to instantiate wasm module")
        .assert_no_start();

    // Finally, invoke the exported function "test" with no parameters
    // and empty external function executor.
    assert_eq!(
        instance
            .invoke_export("test", &[], &mut NopExternals,)
            .expect("failed to execute export"),
        Some(RuntimeValue::F64(1.0.into())),
    ); */
}
