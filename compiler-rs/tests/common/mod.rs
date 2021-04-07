extern crate eel_wasm;

use wasmi::nan_preserving_float::F64;
use wasmi::RuntimeValue;
use wasmi::{
    Error as WasmiError, Externals, FuncInstance, FuncRef, GlobalDescriptor, GlobalInstance,
    GlobalRef, ModuleImportResolver, RuntimeArgs, Signature, Trap, ValueType,
};

pub struct GlobalPool {}

impl GlobalPool {
    fn check_signature(&self, index: usize, signature: &Signature) -> bool {
        let (params, ret_ty): (&[ValueType], Option<ValueType>) = match index {
            SIN_FUNC_INDEX => (&[ValueType::F64], Some(ValueType::F64)),
            _ => return false,
        };
        signature.params() == params && signature.return_type() == ret_ty
    }
}

impl ModuleImportResolver for GlobalPool {
    fn resolve_global(
        &self,
        _field_name: &str,
        _global_type: &GlobalDescriptor,
    ) -> Result<GlobalRef, WasmiError> {
        let global = GlobalInstance::alloc(RuntimeValue::F64(F64::from_float(0.0)), true);
        Ok(global)
    }
    fn resolve_func(&self, field_name: &str, signature: &Signature) -> Result<FuncRef, WasmiError> {
        let index = match field_name {
            "sin" => SIN_FUNC_INDEX,
            _ => {
                return Err(WasmiError::Instantiation(format!(
                    "Export {} not found",
                    field_name
                )))
            }
        };

        if !self.check_signature(index, signature) {
            return Err(WasmiError::Instantiation(format!(
                "Export {} has a bad signature",
                field_name
            )));
        }

        Ok(FuncInstance::alloc_host(
            Signature::new(&[ValueType::F64][..], Some(ValueType::F64)),
            index,
        ))
    }
}

const SIN_FUNC_INDEX: usize = 0;

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
            _ => panic!("Unimplemented function at {}", index),
        }
    }
}
