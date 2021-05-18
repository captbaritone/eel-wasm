extern crate eel_wasm;

use std::{
    collections::{HashMap, HashSet},
    f64::EPSILON,
};

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

fn get_shim_index(shim: Shim) -> usize {
    match shim {
        Shim::Sin => 1,
        Shim::Pow => 2,
        Shim::Cos => 3,
        Shim::Tan => 4,
        Shim::Asin => 5,
        Shim::Acos => 6,
        Shim::Atan => 7,
        Shim::Atan2 => 8,
        Shim::Log => 9,
        Shim::Log10 => 10,
        Shim::Sigmoid => 11,
        Shim::Exp => 12,
    }
}

fn get_shim_from_index(index: usize) -> Shim {
    match index {
        1 => Shim::Sin,
        2 => Shim::Pow,
        3 => Shim::Cos,
        4 => Shim::Tan,
        5 => Shim::Asin,
        6 => Shim::Acos,
        7 => Shim::Atan,
        8 => Shim::Atan2,
        9 => Shim::Log,
        10 => Shim::Log10,
        11 => Shim::Sigmoid,
        12 => Shim::Exp,
        _ => panic!("Could not find shim at index"),
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

        if signature.params().len() != shim.arity() || !signature.return_type().is_some() {
            return Err(WasmiError::Instantiation(format!(
                "Export {} has a bad signature",
                field_name
            )));
        }

        let params = vec![ValueType::F64; shim.arity()];

        Ok(FuncInstance::alloc_host(
            Signature::new(params, Some(ValueType::F64)),
            get_shim_index(shim),
        ))
    }
}

impl Externals for GlobalPool {
    fn invoke_index(
        &mut self,
        index: usize,
        args: RuntimeArgs,
    ) -> Result<Option<RuntimeValue>, Trap> {
        match get_shim_from_index(index) {
            Shim::Sin => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().sin();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Pow => {
                let a: F64 = args.nth_checked(0)?;
                let b: F64 = args.nth_checked(1)?;

                let result = a.to_float().powf(b.to_float());

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Cos => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().cos();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Tan => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().tan();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Asin => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().asin();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Acos => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().acos();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Atan => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().atan();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Atan2 => {
                let a: F64 = args.nth_checked(0)?;
                let b: F64 = args.nth_checked(1)?;

                let result = a.to_float().atan2(b.to_float());

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Log => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().log(std::f64::consts::E);

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Log10 => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().log10();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Sigmoid => {
                let a: F64 = args.nth_checked(0)?;
                let b: F64 = args.nth_checked(1)?;

                let x = a.to_float();
                let y = b.to_float();

                let t = 1.0 + (-x * y).exp();
                let result = if t.abs() > EPSILON { 1.0 / t } else { 0.0 };

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
            Shim::Exp => {
                let a: F64 = args.nth_checked(0)?;

                let result = a.to_float().exp();

                Ok(Some(RuntimeValue::F64(F64::from(result))))
            }
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
