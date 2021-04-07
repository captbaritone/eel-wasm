extern crate eel_wasm;

use std::io;

use eel_wasm::compile;

#[test]
fn run_snapshots() -> io::Result<()> {
    assert_eq!(compile("1+1").unwrap(), [1, 1, 160]);
    assert_eq!(compile("1-1").unwrap(), [1, 1, 161]);
    assert_eq!(compile("1*1").unwrap(), [1, 1, 162]);
    assert_eq!(compile("1/1").unwrap(), [1, 1, 163]);
    Ok(())
}
