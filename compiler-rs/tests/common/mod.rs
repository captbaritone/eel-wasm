extern crate eel_wasm;

use std::collections::{HashMap, HashSet};

use eel_wasm::{compile, Shim};
use wasmi::{nan_preserving_float::F64, ImportsBuilder};
use wasmi::{
    Error as WasmiError, Externals, FuncInstance, FuncRef, GlobalDescriptor, GlobalInstance,
    GlobalRef, ModuleImportResolver, RuntimeArgs, Signature, Trap, ValueType,
};
use wasmi::{ModuleInstance, RuntimeValue};

pub struct GlobalPool {
    g: GlobalRef,
}

impl GlobalPool {
    pub fn new() -> Self {
        Self {
            g: GlobalInstance::alloc(RuntimeValue::F64(0.0.into()), true),
        }
    }
}

impl ModuleImportResolver for GlobalPool {
    fn resolve_global(
        &self,
        field_name: &str,
        _global_type: &GlobalDescriptor,
    ) -> Result<GlobalRef, WasmiError> {
        let global = match field_name {
            "g" => self.g.clone(),
            _ => GlobalInstance::alloc(RuntimeValue::F64(F64::from_float(0.0)), true),
        };
        Ok(global)
    }
    fn resolve_func(&self, field_name: &str, signature: &Signature) -> Result<FuncRef, WasmiError> {
        let shim = Shim::from_str(field_name).ok_or(WasmiError::Instantiation(format!(
            "Export {} not found",
            field_name
        )))?;

        /*
        if !self.check_signature(index, signature) {
            return Err(WasmiError::Instantiation(format!(
                "Export {} has a bad signature",
                field_name
            )));
        }
        */

        Ok(match shim {
            Shim::Sin => FuncInstance::alloc_host(
                Signature::new(&[ValueType::F64][..], Some(ValueType::F64)),
                SIN_FUNC_INDEX,
            ),
            Shim::Pow => FuncInstance::alloc_host(
                Signature::new(&[ValueType::F64, ValueType::F64][..], Some(ValueType::F64)),
                POW_FUNC_INDEX,
            ),
        })
    }
}

const SIN_FUNC_INDEX: usize = 0;
const POW_FUNC_INDEX: usize = 1;

impl Externals for GlobalPool {
    fn invoke_index(
        &mut self,
        index: usize,
        args: RuntimeArgs,
    ) -> Result<Option<RuntimeValue>, Trap> {
        match index {
            SIN_FUNC_INDEX => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().sin();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            POW_FUNC_INDEX => {
                let a: F64 = args.nth_checked(0)?;
                let b: F64 = args.nth_checked(1)?;

                let result = a.to_float().powf(b.to_float());

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            _ => panic!("Unimplemented function at {}", index),
        }
    }
}

pub fn eval_eel(
    sources: Vec<(String, &str, String)>,
    globals_map: HashMap<String, HashSet<String>>,
    function_to_run: &str,
) -> Result<f64, String> {
    // TODO: Avoid having to clone globals
    let wasm_binary = compile(sources, globals_map.clone())
        .map_err(|err| format!("Compiler Error: {:?}", err))?;

    let module = wasmi::Module::from_buffer(&wasm_binary).map_err(|err| {
        // TODO: Print out the wat?
        println!("Wat: {}", wasmprinter::print_bytes(&wasm_binary).unwrap());
        format!("Error parsing binary Wasm: {}", err)
    })?;

    let mut global_imports = GlobalPool::new();
    let mut imports = ImportsBuilder::default();

    for (pool, _) in globals_map {
        // TODO: Only make defined globals resolvable
        imports.push_resolver(pool, &global_imports);
    }

    imports.push_resolver("shims", &global_imports);
    let instance = ModuleInstance::new(&module, &imports)
        .map_err(|err| format!("Error instantiating Wasm module: {}", err))?
        .assert_no_start();

    // TODO: Instead of returning return value, return value of globals
    match instance.invoke_export(function_to_run, &[], &mut global_imports) {
        Ok(Some(_)) => Err("Did not expect to get return from eel function".to_string()),
        Ok(None) => Ok(()),
        Err(err) => Err(format!(
            "Error invoking exported function {}: {}",
            function_to_run, err
        )),
    }?;
    let g = global_imports.g.get().try_into::<F64>().unwrap();
    Ok(g.into())
}
