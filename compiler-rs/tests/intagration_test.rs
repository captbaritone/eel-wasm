extern crate eel_wasm;

use std::io;

use eel_wasm::compile;

#[test]
fn run_snapshots() -> io::Result<()> {
    let output = compile("1+1").unwrap();

    assert_eq!(output, [1, 1, 160]);
    Ok(())
}
