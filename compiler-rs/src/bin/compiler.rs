use eel_wasm::compile;
use std::fs;
use std::process;

use std::path::PathBuf;
use structopt::StructOpt;

#[derive(Debug, StructOpt)]
#[structopt(name = "eel-wasm", about = "Compile Eel code to WebAssembly.")]
struct Opt {
    /// Input file
    #[structopt(parse(from_os_str))]
    input: PathBuf,

    /// Output file, stdout if not present
    #[structopt(parse(from_os_str))]
    output: PathBuf,
}

fn main() {
    let opt = Opt::from_args();
    let filename = opt.input;
    let source = fs::read_to_string(filename).unwrap_or_else(|err| {
        eprintln!("Error reading file: {}", err);
        process::exit(1);
    });

    let result = compile(&source, vec![]).unwrap_or_else(|err| {
        eprintln!("{}", err);
        process::exit(1);
    });

    fs::write(opt.output, result).unwrap_or_else(|err| {
        eprintln!("Error writing output: {}", err);
        process::exit(1);
    });

    println!("Done.");
}
