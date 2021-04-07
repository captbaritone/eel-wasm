extern crate eel_wasm;

use std::{collections::HashMap, io};

use eel_wasm::compile;
use wasmi::{
    nan_preserving_float::F64, Error as WasmiError, GlobalDescriptor, GlobalInstance, GlobalRef,
    ImportsBuilder, ModuleImportResolver, ModuleInstance, NopExternals, RuntimeValue,
};

fn run(body: &[u8]) -> Result<f64, String> {
    let wasm_binary = body;
    let module = wasmi::Module::from_buffer(&wasm_binary).expect("failed to load wasm");
    let instance = ModuleInstance::new(&module, &ImportsBuilder::default())
        .expect("failed to instantiate wasm module")
        .assert_no_start();

    // Finally, invoke the exported function "test" with no parameters
    // and empty external function executor.
    match instance
        .invoke_export("test", &[], &mut NopExternals)
        .expect("failed to execute export")
    {
        Some(RuntimeValue::F64(val)) => Ok(val.into()),
        Some(val) => Err(format!("Unexpected return type: {:?}", val)),
        None => Err("No Result".to_string()),
    }
}

fn test_run(program: &str, expected_output: f64) {
    assert_eq!(
        run(&compile(vec![("test".to_string(), program)], vec![]).unwrap()).expect("Run Error"),
        expected_output
    );
}

#[test]
fn build_one() -> io::Result<()> {
    assert_eq!(
        &compile(vec![("test".to_string(), "1")], vec![]).unwrap(),
        &[
            0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 124, 3, 2, 1, 0, 7, 8, 1, 4, 116, 101,
            115, 116, 0, 0, 10, 13, 1, 11, 0, 68, 0, 0, 0, 0, 0, 0, 240, 63, 11,
        ]
    );
    Ok(())
}

#[test]
fn execute_one() {
    test_run("1", 1.0);
    test_run("1+1", 2.0);
    test_run("1-1", 0.0);
    test_run("2*2", 4.0);
    test_run("2/2", 1.0);

    test_run("1+1*2", 3.0);
}

struct GlobalPool {
    globals: HashMap<String, GlobalRef>,
}

impl ModuleImportResolver for GlobalPool {
    fn resolve_global(
        &self,
        field_name: &str,
        _global_type: &GlobalDescriptor,
    ) -> Result<GlobalRef, WasmiError> {
        let global = GlobalInstance::alloc(RuntimeValue::F64(F64::from_float(0.0)), true);
        Ok(global)
    }
}

#[test]
#[ignore]
fn with_global() {
    let global_imports = GlobalPool {
        globals: HashMap::default(),
    };
    let wasm_binary = compile(vec![("test".to_string(), "g=1")], vec!["g".to_string()])
        .expect("Expect to compile");
    // TODO: This will fail becuase wasmi 0.8.0 depends upon wasmi-validaiton
    // 0.3.0 which does not include https://github.com/paritytech/wasmi/pull/228
    // which allows mutable globals.
    // 0.3.1 has the PR, but wasmi has not shipped a new version that includes it.
    // parity-wasm already depends upon 0.3.1 (I _think_)
    let module = wasmi::Module::from_buffer(&wasm_binary).expect("No validation errors");
    let mut imports = ImportsBuilder::default();
    imports.push_resolver("pool", &global_imports);
    let instance = ModuleInstance::new(&module, &imports)
        .expect("failed to instantiate wasm module")
        .assert_no_start();

    // Finally, invoke the exported function "test" with no parameters
    // and empty external function executor.
    instance
        .invoke_export("test", &[], &mut NopExternals)
        .expect("failed to execute export")
        .expect("Ran");
}

#[test]
fn multiple_functions() {
    let wasm_binary = compile(
        vec![("one".to_string(), "1"), ("two".to_string(), "2")],
        vec![],
    )
    .expect("Expect to compile");
    // TODO: This will fail becuase wasmi 0.8.0 depends upon wasmi-validaiton
    // 0.3.0 which does not include https://github.com/paritytech/wasmi/pull/228
    // which allows mutable globals.
    // 0.3.1 has the PR, but wasmi has not shipped a new version that includes it.
    // parity-wasm already depends upon 0.3.1 (I _think_)
    let module = wasmi::Module::from_buffer(&wasm_binary).expect("No validation errors");
    let instance = ModuleInstance::new(&module, &ImportsBuilder::default())
        .expect("failed to instantiate wasm module")
        .assert_no_start();

    instance
        .invoke_export("one", &[], &mut NopExternals)
        .expect("failed to execute export")
        .expect("Ran");

    instance
        .invoke_export("two", &[], &mut NopExternals)
        .expect("failed to execute export")
        .expect("Ran");
}
