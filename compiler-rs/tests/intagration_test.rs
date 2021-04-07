extern crate eel_wasm;

use std::io;

use eel_wasm::compile;
use wasmi::{ImportsBuilder, ModuleInstance, NopExternals, RuntimeValue};

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
        run(&compile(program).unwrap()).expect("Run Error"),
        expected_output
    );
}

#[test]
fn build_one() -> io::Result<()> {
    assert_eq!(
        &compile("1").unwrap(),
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
