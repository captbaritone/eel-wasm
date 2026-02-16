extern crate wabt;
extern crate wasmi;

use wasmi::ImportsBuilder;
use wasmi::{ModuleInstance, NopExternals, RuntimeValue};

#[test]
fn wasm_test() {
    // Parse WAT (WebAssembly Text format) into wasm bytecode.
    let wasm_binary: Vec<u8> = wabt::wat2wasm(
        r#"
            (module
                (func (export "test") (result f64)
                    f64.const 1
                    f64.const 1
                    f64.add
                )
            )
            "#,
    )
    .expect("failed to parse wat");

    // println!("{:?}", wasm_binary);
    // Load wasm binary and prepare it for instantiation.
    let module = wasmi::Module::from_buffer(&wasm_binary).expect("failed to load wasm");
    let imports = ImportsBuilder::default();
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
        Some(RuntimeValue::F64(2.0.into())),
    );
}
