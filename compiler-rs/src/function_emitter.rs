use crate::utils::f64_const;
use crate::{
    ast::{
        Assignment, BinaryExpression, BinaryOperator, EelFunction, Expression, ExpressionBlock,
        FunctionCall, UnaryExpression, UnaryOperator,
    },
    builtin_functions::BuiltinFunction,
    constants::BUFFER_SIZE,
    error::CompilerError,
    index_store::IndexStore,
    shim::Shim,
    EelFunctionType,
};
use crate::{constants::EPSILON, error::EmitterResult};
use parity_wasm::elements::{BlockType, FuncBody, Instruction, Instructions, Local, ValueType};

pub fn emit_function(
    eel_function: EelFunction,
    current_pool: String,
    globals: &mut IndexStore<(Option<String>, String)>,
    shims: &mut IndexStore<Shim>,
    builtin_functions: &mut IndexStore<BuiltinFunction>,
    function_types: &mut IndexStore<EelFunctionType>,
    builtin_offset: &Option<u32>,
) -> EmitterResult<FuncBody> {
    let mut function_emitter = FunctionEmitter::new(
        current_pool,
        globals,
        shims,
        builtin_functions,
        function_types,
        builtin_offset,
    );

    function_emitter.emit_expression_block(eel_function.expressions)?;

    let mut instructions: Vec<Instruction> = function_emitter.instructions;
    instructions.push(Instruction::Drop);
    instructions.push(Instruction::End);

    let locals = function_emitter
        .locals
        .into_iter()
        .map(|type_| Local::new(1, type_))
        .collect();

    Ok(FuncBody::new(locals, Instructions::new(instructions)))
}

struct FunctionEmitter<'a> {
    current_pool: String,
    globals: &'a mut IndexStore<(Option<String>, String)>,
    shims: &'a mut IndexStore<Shim>,
    builtin_functions: &'a mut IndexStore<BuiltinFunction>,
    function_types: &'a mut IndexStore<EelFunctionType>,
    builtin_offset: &'a Option<u32>,
    locals: Vec<ValueType>,
    instructions: Vec<Instruction>,
}

impl<'a> FunctionEmitter<'a> {
    fn new(
        current_pool: String,
        globals: &'a mut IndexStore<(Option<String>, String)>,
        shims: &'a mut IndexStore<Shim>,
        builtin_functions: &'a mut IndexStore<BuiltinFunction>,
        function_types: &'a mut IndexStore<EelFunctionType>,
        builtin_offset: &'a Option<u32>,
    ) -> Self {
        Self {
            current_pool,
            globals,
            shims,
            function_types,
            builtin_functions,
            builtin_offset,
            locals: Vec::new(),
            instructions: Vec::new(),
        }
    }

    fn emit_expression_block(&mut self, block: ExpressionBlock) -> EmitterResult<()> {
        let last_index = block.expressions.len() - 1;
        for (i, expression) in block.expressions.into_iter().enumerate() {
            self.emit_expression(expression)?;
            if i != last_index {
                self.push(Instruction::Drop)
            }
        }
        Ok(())
    }

    fn emit_expression(&mut self, expression: Expression) -> EmitterResult<()> {
        match expression {
            Expression::UnaryExpression(unary_expression) => {
                self.emit_unary_expression(unary_expression)
            }
            Expression::BinaryExpression(binary_expression) => {
                self.emit_binary_expression(binary_expression)
            }
            Expression::Assignment(assignment_expression) => {
                self.emit_assignment(assignment_expression)
            }
            Expression::NumberLiteral(number_literal) => {
                self.push(Instruction::F64Const(f64_const(number_literal.value)));
                Ok(())
            }
            Expression::FunctionCall(function_call) => self.emit_function_call(function_call),
            Expression::ExpressionBlock(expression_block) => {
                self.emit_expression_block(expression_block)
            }
            Expression::Identifier(identifier) => {
                let index = self.resolve_variable(identifier.name);
                self.push(Instruction::GetGlobal(index));
                Ok(())
            }
        }
    }

    fn emit_unary_expression(&mut self, unary_expression: UnaryExpression) -> EmitterResult<()> {
        match unary_expression.op {
            UnaryOperator::Plus => self.emit_expression(*unary_expression.right),
            UnaryOperator::Minus => {
                self.emit_expression(*unary_expression.right)?;
                self.push(Instruction::F64Neg);
                Ok(())
            }
            UnaryOperator::Not => {
                self.emit_expression(*unary_expression.right)?;
                self.instructions.extend(vec![
                    Instruction::F64Abs,
                    Instruction::F64Const(f64_const(EPSILON)),
                    Instruction::F64Lt,
                ]);
                self.push(Instruction::F64ConvertSI32);
                Ok(())
            }
        }
    }

    fn emit_binary_expression(&mut self, binary_expression: BinaryExpression) -> EmitterResult<()> {
        self.emit_expression(*binary_expression.left)?;
        self.emit_expression(*binary_expression.right)?;
        match binary_expression.op {
            BinaryOperator::Add => self.push(Instruction::F64Add),
            BinaryOperator::Subtract => self.push(Instruction::F64Sub),
            BinaryOperator::Multiply => self.push(Instruction::F64Mul),
            BinaryOperator::Divide => {
                let func_index = self.resolve_builtin_function(BuiltinFunction::Div);
                self.push(Instruction::Call(func_index))
            }
            BinaryOperator::Eq => {
                self.push(Instruction::F64Sub);
                self.emit_is_zeroish();
                self.push(Instruction::F64ConvertSI32)
            }
        };
        Ok(())
    }

    fn emit_assignment(&mut self, assignment_expression: Assignment) -> EmitterResult<()> {
        let resolved_name = self.resolve_variable(assignment_expression.left.name);
        self.emit_expression(*assignment_expression.right)?;

        self.push(Instruction::SetGlobal(resolved_name));
        self.push(Instruction::GetGlobal(resolved_name));
        Ok(())
    }

    fn emit_function_call(&mut self, mut function_call: FunctionCall) -> EmitterResult<()> {
        match &function_call.name.name[..] {
            "int" => {
                assert_arity(&function_call, 1)?;
                for arg in function_call.arguments {
                    self.emit_expression(arg)?;
                }
                self.push(Instruction::F64Floor);
            }
            "if" => {
                assert_arity(&function_call, 3)?;

                let alternate = function_call.arguments.pop().unwrap();
                let consiquent = function_call.arguments.pop().unwrap();
                let test = function_call.arguments.pop().unwrap();

                self.emit_expression(test)?;
                self.emit_is_not_zeroish();
                self.push(Instruction::If(BlockType::Value(ValueType::F64)));
                self.emit_expression(consiquent)?;
                self.push(Instruction::Else);
                self.emit_expression(alternate)?;
                self.push(Instruction::End);
            }
            "megabuf" => self.emit_memory_access(&mut function_call, 0)?,
            "gmegabuf" => self.emit_memory_access(&mut function_call, BUFFER_SIZE * 8)?,
            shim_name if Shim::from_str(shim_name).is_some() => {
                let shim = Shim::from_str(shim_name).unwrap();
                assert_arity(&function_call, shim.arity())?;

                for arg in function_call.arguments {
                    self.emit_expression(arg)?;
                }
                let shim_index = self.shims.get(shim);
                self.push(Instruction::Call(shim_index));
            }
            _ => {
                return Err(CompilerError::new(
                    format!("Unknown function `{}`", function_call.name.name),
                    function_call.name.span,
                ))
            }
        }
        Ok(())
    }

    fn emit_memory_access(
        &mut self,
        function_call: &mut FunctionCall,
        memory_offset: u32,
    ) -> EmitterResult<()> {
        assert_arity(&function_call, 1)?;
        let index = self.resolve_local(ValueType::I32);
        self.emit_expression(function_call.arguments.pop().unwrap())?;

        let call_index = self.resolve_builtin_function(BuiltinFunction::GetBufferIndex);
        self.push(Instruction::Call(call_index));
        //
        self.push(Instruction::TeeLocal(index));
        self.push(Instruction::I32Const(-1));
        self.push(Instruction::I32Ne);
        // STACK: [in range]
        self.push(Instruction::If(BlockType::Value(ValueType::F64)));
        self.push(Instruction::GetLocal(index));
        self.push(Instruction::F64Load(3, memory_offset));
        self.push(Instruction::Else);
        self.push(Instruction::F64Const(f64_const(0.0)));
        self.push(Instruction::End);

        Ok(())
    }

    fn resolve_variable(&mut self, name: String) -> u32 {
        let pool = if variable_is_register(&name) {
            None
        } else {
            Some(self.current_pool.clone())
        };

        self.globals.get((pool, name))
    }

    fn resolve_local(&mut self, type_: ValueType) -> u32 {
        self.locals.push(type_);
        return self.locals.len() as u32 - 1;
    }

    fn resolve_builtin_function(&mut self, builtin: BuiltinFunction) -> u32 {
        self.function_types.ensure(builtin.get_type());
        let offset = self
            .builtin_offset
            .expect("Tried to compute builtin index before setting offset.");
        self.builtin_functions.get(builtin) + offset
    }

    fn push(&mut self, instruction: Instruction) {
        self.instructions.push(instruction)
    }

    fn emit_is_not_zeroish(&mut self) {
        self.push(Instruction::F64Abs);
        self.push(Instruction::F64Const(f64_const(EPSILON)));
        self.push(Instruction::F64Gt);
    }

    fn emit_is_zeroish(&mut self) {
        self.push(Instruction::F64Abs);
        self.push(Instruction::F64Const(f64_const(EPSILON)));
        self.push(Instruction::F64Lt);
    }
}

fn variable_is_register(name: &str) -> bool {
    let chars: Vec<_> = name.chars().collect();
    // We avoided pulling in the regex crate! (But at what cost?)
    matches!(chars.as_slice(), ['r', 'e', 'g', '0'..='9', '0'..='9'])
}

fn assert_arity(function_call: &FunctionCall, arity: usize) -> EmitterResult<()> {
    if function_call.arguments.len() != arity {
        Err(CompilerError::new(
            format!(
                "Incorrect argument count for function `{}`. Expected {} but got {}.",
                function_call.name.name,
                arity,
                function_call.arguments.len()
            ),
            // TODO: Better to underline the argument list
            function_call.name.span,
        ))
    } else {
        Ok(())
    }
}
