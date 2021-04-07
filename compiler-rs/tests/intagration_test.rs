extern crate eel_wasm;

use std::io;

use eel_wasm::compile;
use wasmi::{ImportsBuilder, ModuleInstance, NopExternals, RuntimeValue};

fn build(body: &[u8]) -> Vec<u8> {
    let prefix = &[
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 124, 3, 2, 1, 0, 7, 8, 1, 4, 116, 101, 115,
        116, 0, 0, 10, //
        // These bits need to reflect the code len
        13, 1, 11, 0,
    ];
    let suffix = &[11];

    let mut result = Vec::with_capacity(prefix.len() + body.len() + suffix.len());
    result.extend_from_slice(prefix);
    result.extend_from_slice(body);
    result.extend_from_slice(suffix);
    result
}

fn run(body: &[u8]) -> f64 {
    let wasm_binary = build(body);
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
        Some(RuntimeValue::F64(val)) => val.into(),
        None => 0.0,
        _ => 0.0,
    }
}

#[test]
fn compile_one() -> io::Result<()> {
    assert_eq!(&compile("1").unwrap(), &[68, 0, 0, 0, 0, 0, 0, 240, 63,]);
    Ok(())
}

#[test]
fn build_one() -> io::Result<()> {
    assert_eq!(
        &build(&compile("1").unwrap()),
        &[
            0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 124, 3, 2, 1, 0, 7, 8, 1, 4, 116, 101,
            115, 116, 0, 0, 10, 13, 1, 11, 0, 68, 0, 0, 0, 0, 0, 0, 240, 63, 11,
        ]
    );
    Ok(())
}

/*
#[test]
fn build_one_plus_one() -> io::Result<()> {
    assert_eq!(
        &build(&compile("1+1").unwrap()),
        &[
            0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 124, 3, 2, 1, 0, 7, 8, 1, 4, 116, 101,
            115, 116, 0, 0, 10, 23, 1, 21, 0, 68, 0, 0, 0, 0, 0, 0, 240, 63, 68, 0, 0, 0, 0, 0, 0,
            240, 63, 160, 11
        ]
    );
    Ok(())
} */

#[test]
fn execute_one() -> io::Result<()> {
    assert_eq!(run(&compile("1").unwrap()), 1.0);
    Ok(())
}
