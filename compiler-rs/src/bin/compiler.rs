use eel_wasm::compile;
use std::env;
use std::fs;
use std::process;

fn main() {
    let args: Vec<String> = env::args().collect();
    let filename = args.get(1).unwrap_or_else(|| {
        eprintln!("Usage: compile INPUT");
        process::exit(1);
    });
    let source = fs::read_to_string(filename).unwrap_or_else(|err| {
        eprintln!("Error reading file \"{}\": {}", filename, err);
        process::exit(1);
    });

    let result = compile(&source).unwrap_or_else(|err| {
        eprintln!("{}", err);
        process::exit(1);
    });

    println!("{:?}", result);
}
