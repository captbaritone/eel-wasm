extern crate eel_wasm;
mod common;

use common::GlobalPool;
use eel_wasm::compile;
use wasmi::{ImportsBuilder, ModuleInstance, RuntimeValue};

fn run(body: &[u8]) -> Result<f64, String> {
    let wasm_binary = body;
    let module = wasmi::Module::from_buffer(&wasm_binary).expect("failed to load wasm");

    let mut global_imports = GlobalPool {};
    let mut imports = ImportsBuilder::default();
    imports.push_resolver("pool", &global_imports);
    imports.push_resolver("shims", &global_imports);
    let instance = ModuleInstance::new(&module, &imports)
        .expect("failed to instantiate wasm module")
        .assert_no_start();

    match instance
        .invoke_export("test", &[], &mut global_imports)
        .expect("failed to execute export")
    {
        Some(RuntimeValue::F64(val)) => Ok(val.into()),
        Some(val) => Err(format!("Unexpected return type: {:?}", val)),
        None => Err("No Result".to_string()),
    }
}

fn test_run(program: &str, expected_output: f64) {
    assert_eq!(
        run(&compile(
            vec![("test".to_string(), program, "pool".to_string())],
            vec![]
        )
        .unwrap())
        .expect("Run Error"),
        expected_output
    );
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

#[test]
fn with_global() {
    test_run("g=1", 1.0);
}

#[test]
fn with_shims() {
    test_run("sin(10)", 10.0_f64.sin());
}

#[test]
fn multiple_functions() {
    let wasm_binary = compile(
        vec![
            ("one".to_string(), "1", "pool".to_string()),
            ("two".to_string(), "2", "pool".to_string()),
        ],
        vec![],
    )
    .expect("Expect to compile");
    // TODO: This will fail becuase wasmi 0.8.0 depends upon wasmi-validaiton
    // 0.3.0 which does not include https://github.com/paritytech/wasmi/pull/228
    // which allows mutable globals.
    // 0.3.1 has the PR, but wasmi has not shipped a new version that includes it.
    // parity-wasm already depends upon 0.3.1 (I _think_)
    let module = wasmi::Module::from_buffer(&wasm_binary).expect("No validation errors");
    let mut global_imports = GlobalPool {};
    let mut imports = ImportsBuilder::default();
    imports.push_resolver("pool", &global_imports);
    imports.push_resolver("shims", &global_imports);

    let instance = ModuleInstance::new(&module, &imports)
        .expect("failed to instantiate wasm module")
        .assert_no_start();

    instance
        .invoke_export("one", &[], &mut global_imports)
        .expect("failed to execute export")
        .expect("Ran");

    instance
        .invoke_export("two", &[], &mut global_imports)
        .expect("failed to execute export")
        .expect("Ran");
}
