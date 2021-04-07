extern crate eel_wasm;

use std::env;
use std::fs;
use std::io;
use std::path::PathBuf;

use eel_wasm::compile;
use eel_wasm::parse;

fn get_fixture_dir_path(dir: &str) -> io::Result<PathBuf> {
    let mut fixture_dir = env::current_dir()?;
    fixture_dir.push(dir);
    Ok(fixture_dir)
}

#[test]
fn run_snapshots() -> io::Result<()> {
    run_snapshots_impl("tests/fixtures/wat", compiler_transform)?;
    run_snapshots_impl("tests/fixtures/ast", ast_transform)?;
    Ok(())
}

fn run_snapshots_impl<F>(dir: &str, transform: F) -> io::Result<()>
where
    F: Fn(&str) -> (String, bool),
{
    let line = "========================================================================";
    for entry in fs::read_dir(get_fixture_dir_path(dir)?)? {
        let entry = entry?;
        let path = &entry.path();
        if let Some(ext) = path.extension() {
            if ext == "snapshot" {
                // TODO: We could assert that this snapshot file has a matching
                // source file and clean up any extranious files.
                continue;
            }
        }
        let source_path = path.file_name().unwrap().to_string_lossy();
        let expected_invalid = source_path.ends_with(".invalid.eel");
        let snapshot_file_path = path.with_extension("snapshot");

        let source = fs::read_to_string(path)?;

        let (output_str, actual_invalid) = transform(&source);

        let snapshot = format!("{}\n{}\n{}\n", source, line, output_str);

        if !snapshot_file_path.exists() || env::var("UPDATE_SNAPSHOTS").is_ok() {
            fs::write(snapshot_file_path, snapshot)?;
        } else {
            let actual_snapshot = fs::read_to_string(snapshot_file_path)?;
            // TODO: We could improve the diff output
            // TODO: We could inform the user that they can set the UPDATE_SNAPSHOTS environment variable to update.
            assert_eq!(snapshot, actual_snapshot, "Expected snapshot for {} to match, but it did not.\nRerun with `UPDATE_SNAPSHOTS=1 to update.`", source_path);
        }

        let actual_str = if actual_invalid { "invalid" } else { "valid" };
        let expected_str = if expected_invalid { "invalid" } else { "valid" };

        assert_eq!(
            actual_invalid, expected_invalid,
            "Expected file \"{}\" to be {} but it was {}",
            source_path, actual_str, expected_str
        );
    }

    Ok(())
}

fn compiler_transform(src: &str) -> (String, bool) {
    let output = compile(vec![("test".to_string(), src)], vec![]);

    let actual_invaid = output.is_err();

    let output_str: String = match output {
        Ok(binary) => wasmprinter::print_bytes(&binary).unwrap(),
        Err(err) => err.pretty_print(src),
    };
    (output_str, actual_invaid)
}

fn ast_transform(src: &str) -> (String, bool) {
    let output = parse(src);

    let actual_invaid = output.is_err();

    let output_str: String = match output {
        Ok(ast) => format!("{:#?}", ast),
        Err(err) => err.pretty_print(src),
    };
    (output_str, actual_invaid)
}
