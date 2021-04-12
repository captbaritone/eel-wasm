use crate::utils::f64_const;
use crate::{ast::AssignmentOperator, emitter_context::EmitterContext};
use crate::{
    ast::{
        Assignment, AssignmentTarget, BinaryExpression, BinaryOperator, EelFunction, Expression,
        ExpressionBlock, FunctionCall, UnaryExpression, UnaryOperator,
    },
    builtin_functions::BuiltinFunction,
    constants::BUFFER_SIZE,
    error::CompilerError,
    shim::Shim,
};
use crate::{constants::EPSILON, error::EmitterResult};
use parity_wasm::elements::{BlockType, FuncBody, Instruction, Instructions, Local, ValueType};

// https://github.com/WACUP/vis_milk2/blob/de9625a89e724afe23ed273b96b8e48496095b6c/ns-eel2/ns-eel.h#L136
static MAX_LOOP_COUNT: i32 = 1048576;

pub fn emit_function(
    eel_function: EelFunction,
    context: &mut EmitterContext,
) -> EmitterResult<FuncBody> {
    let mut function_emitter = FunctionEmitter::new(context);

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
    context: &'a mut EmitterContext,
    instructions: Vec<Instruction>,
    locals: Vec<ValueType>,
}

impl<'a> FunctionEmitter<'a> {
    fn new(context: &'a mut EmitterContext) -> Self {
        Self {
            context,
            locals: Vec::new(),
            instructions: Vec::new(),
        }
    }

    fn emit_expression_block(&mut self, block: ExpressionBlock) -> EmitterResult<()> {
        self.emit_expression_list(block.expressions)
    }

    fn emit_expression_list(&mut self, expressions: Vec<Expression>) -> EmitterResult<()> {
        let last_index = expressions.len() - 1;
        for (i, expression) in expressions.into_iter().enumerate() {
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
                let index = self.context.resolve_variable(identifier.name);
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
    fn emit_logical_expression(
        &mut self,
        left: Expression,
        right: Expression,
        and: bool,
    ) -> EmitterResult<()> {
        self.emit_expression(left)?;
        if and {
            self.emit_is_zeroish();
        } else {
            self.emit_is_not_zeroish();
        }
        self.push(Instruction::If(BlockType::Value(ValueType::F64)));
        self.push(Instruction::F64Const(f64_const(if and {
            0.0
        } else {
            1.0
        })));
        self.push(Instruction::Else);
        self.emit_expression(right)?;
        self.emit_is_not_zeroish();
        self.push(Instruction::F64ConvertSI32);
        self.push(Instruction::End);
        Ok(())
    }

    fn emit_binary_expression(&mut self, binary_expression: BinaryExpression) -> EmitterResult<()> {
        match binary_expression.op {
            BinaryOperator::LogicalAnd => {
                return self.emit_logical_expression(
                    *binary_expression.left,
                    *binary_expression.right,
                    true,
                );
            }
            BinaryOperator::LogicalOr => {
                return self.emit_logical_expression(
                    *binary_expression.left,
                    *binary_expression.right,
                    false,
                );
            }
            _ => {}
        }
        self.emit_expression(*binary_expression.left)?;
        self.emit_expression(*binary_expression.right)?;
        match binary_expression.op {
            BinaryOperator::LogicalAnd | BinaryOperator::LogicalOr => {
                // Handled above. Is there was a cleaner way to do this?
            }
            BinaryOperator::Add => self.push(Instruction::F64Add),
            BinaryOperator::Subtract => self.push(Instruction::F64Sub),
            BinaryOperator::Multiply => self.push(Instruction::F64Mul),
            BinaryOperator::Divide => {
                let func_index = self.context.resolve_builtin_function(BuiltinFunction::Div);
                self.push(Instruction::Call(func_index))
            }
            BinaryOperator::Mod => {
                let func_index = self.context.resolve_builtin_function(BuiltinFunction::Mod);
                self.push(Instruction::Call(func_index))
            }
            BinaryOperator::Eq => {
                self.push(Instruction::F64Sub);
                self.emit_is_zeroish();
                self.push(Instruction::F64ConvertSI32)
            }
            BinaryOperator::NotEqual => {
                self.push(Instruction::F64Sub);
                self.emit_is_not_zeroish();
                self.push(Instruction::F64ConvertSI32)
            }
            BinaryOperator::LessThan => {
                self.push(Instruction::F64Lt);
                self.push(Instruction::F64ConvertSI32)
            }
            BinaryOperator::GreaterThan => {
                self.push(Instruction::F64Gt);
                self.push(Instruction::F64ConvertSI32)
            }
            BinaryOperator::LessThanEqual => {
                self.push(Instruction::F64Le);
                self.push(Instruction::F64ConvertSI32)
            }
            BinaryOperator::GreaterThanEqual => {
                self.push(Instruction::F64Ge);
                self.push(Instruction::F64ConvertSI32)
            }
            BinaryOperator::BitwiseAnd => {
                let func_index = self
                    .context
                    .resolve_builtin_function(BuiltinFunction::BitwiseAnd);
                self.push(Instruction::Call(func_index))
            }
            BinaryOperator::BitwiseOr => {
                let func_index = self
                    .context
                    .resolve_builtin_function(BuiltinFunction::BitwiseOr);
                self.push(Instruction::Call(func_index))
            }
            BinaryOperator::Pow => {
                let shim_index = self.context.resolve_shim_function(Shim::Pow);
                self.push(Instruction::Call(shim_index))
            }
        };
        Ok(())
    }

    fn emit_assignment(&mut self, assignment_expression: Assignment) -> EmitterResult<()> {
        let updater: Option<Instruction> = match assignment_expression.operator {
            AssignmentOperator::Equal => None,
            AssignmentOperator::PlusEqual => Some(Instruction::F64Add),
            AssignmentOperator::MinusEqual => Some(Instruction::F64Sub),
            AssignmentOperator::TimesEqual => Some(Instruction::F64Mul),
            AssignmentOperator::DivEqual => Some(Instruction::F64Div),
            AssignmentOperator::ModEqual => {
                let index = self.context.resolve_builtin_function(BuiltinFunction::Mod);
                Some(Instruction::Call(index))
            }
        };

        match assignment_expression.left {
            AssignmentTarget::Identifier(identifier) => {
                let resolved_name = self.context.resolve_variable(identifier.name);
                match updater {
                    None => {
                        self.emit_expression(*assignment_expression.right)?;

                        self.push(Instruction::SetGlobal(resolved_name));
                        self.push(Instruction::GetGlobal(resolved_name));
                    }
                    Some(update) => {
                        self.push(Instruction::GetGlobal(resolved_name));
                        self.emit_expression(*assignment_expression.right)?;
                        self.push(update);
                        self.push(Instruction::SetGlobal(resolved_name));
                        self.push(Instruction::GetGlobal(resolved_name));
                    }
                }
                Ok(())
            }
            AssignmentTarget::FunctionCall(mut function_call) => {
                let memory_offset = match &function_call.name.name[..] {
                    "megabuf" => 0,
                    "gmegabuf" => BUFFER_SIZE * 8,
                    _ => Err(CompilerError::new(
                        "Only `megabuf()` and `gmegabuf()` can be an assignemnt targets."
                            .to_string(),
                        function_call.name.span,
                    ))?,
                };
                // assert arity, assert name
                match updater {
                    None => {
                        // TODO: Move this to builtin_functions
                        let unnormalized_index = self.resolve_local(ValueType::I32);
                        let right_value = self.resolve_local(ValueType::F64);

                        let index = function_call.arguments.pop().unwrap();
                        // Emit the right hand side unconditionally to ensure it always runs.
                        self.emit_expression(*assignment_expression.right)?;
                        self.push(Instruction::SetLocal(right_value));
                        self.emit_expression(index)?;
                        let get_buffer_index = self
                            .context
                            .resolve_builtin_function(BuiltinFunction::GetBufferIndex);
                        self.push(Instruction::Call(get_buffer_index));
                        self.push(Instruction::TeeLocal(unnormalized_index));
                        self.push(Instruction::I32Const(0));
                        self.push(Instruction::I32LtS);
                        // STACK: [is the index out of range?]
                        self.push(Instruction::If(BlockType::Value(ValueType::F64)));
                        self.push(Instruction::F64Const(f64_const(0.0)));
                        self.push(Instruction::Else);
                        self.push(Instruction::GetLocal(unnormalized_index));
                        self.push(Instruction::TeeLocal(unnormalized_index));
                        // STACK: [buffer index]
                        self.push(Instruction::GetLocal(right_value));
                        // STACK: [buffer index, right]
                        self.push(Instruction::F64Store(3, memory_offset));
                        // STACK: []
                        self.push(Instruction::GetLocal(right_value));
                        // STACK: [Right/Buffer value]
                        self.push(Instruction::End);
                        Ok(())
                    }
                    Some(update) => {
                        // TODO: Move this to wasmFunctions once we know how to call functions
                        // from within functions (need to get the offset).
                        let index = self.resolve_local(ValueType::I32);
                        let in_bounds = self.resolve_local(ValueType::I32);
                        let right_value = self.resolve_local(ValueType::F64);
                        let result = self.resolve_local(ValueType::F64);
                        let left = function_call.arguments.pop().unwrap();
                        self.emit_expression(*assignment_expression.right)?;
                        self.push(Instruction::SetLocal(right_value));
                        self.emit_expression(left)?;
                        let get_buffer_index = self
                            .context
                            .resolve_builtin_function(BuiltinFunction::GetBufferIndex);
                        self.push(Instruction::Call(get_buffer_index));
                        self.push(Instruction::TeeLocal(index));
                        // STACK: [index]
                        self.push(Instruction::I32Const(-1));
                        self.push(Instruction::I32Ne);
                        self.push(Instruction::TeeLocal(in_bounds));
                        self.push(Instruction::If(BlockType::Value(ValueType::F64)));
                        self.push(Instruction::GetLocal(index));
                        self.push(Instruction::F64Load(3, memory_offset));
                        self.push(Instruction::Else);
                        self.push(Instruction::F64Const(f64_const(0.0)));
                        self.push(Instruction::End);
                        // STACK: [current value from memory || 0]
                        // Apply the mutation
                        self.push(Instruction::GetLocal(right_value));
                        self.push(update);
                        self.push(Instruction::TeeLocal(result));
                        self.push(Instruction::GetLocal(in_bounds));
                        // STACK: [new value]
                        self.push(Instruction::If(BlockType::NoResult));
                        self.push(Instruction::GetLocal(index));
                        self.push(Instruction::GetLocal(result));
                        self.push(Instruction::F64Store(3, memory_offset));
                        self.push(Instruction::End);
                        Ok(())
                    }
                }
            }
        }
    }

    fn emit_function_call(&mut self, mut function_call: FunctionCall) -> EmitterResult<()> {
        match &function_call.name.name[..] {
            "int" => {
                assert_arity(&function_call, 1)?;
                self.emit_function_args(function_call)?;

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
            "abs" => {
                assert_arity(&function_call, 1)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Abs)
            }
            "sqrt" => {
                assert_arity(&function_call, 1)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Abs);
                self.push(Instruction::F64Sqrt)
            }
            "min" => {
                assert_arity(&function_call, 2)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Min)
            }
            "max" => {
                assert_arity(&function_call, 2)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Max)
            }
            "above" => {
                assert_arity(&function_call, 2)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Gt);
                self.push(Instruction::F64ConvertSI32)
            }
            "below" => {
                assert_arity(&function_call, 2)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Lt);
                self.push(Instruction::F64ConvertSI32)
            }
            "equal" => {
                assert_arity(&function_call, 2)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Sub);
                self.emit_is_zeroish();
                self.push(Instruction::F64ConvertSI32)
            }
            "bnot" => {
                assert_arity(&function_call, 1)?;
                self.emit_function_args(function_call)?;

                self.emit_is_zeroish();
                self.push(Instruction::F64ConvertSI32)
            }
            "floor" => {
                assert_arity(&function_call, 1)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Floor)
            }
            "ceil" => {
                assert_arity(&function_call, 1)?;
                self.emit_function_args(function_call)?;

                self.push(Instruction::F64Ceil)
            }
            "sqr" => {
                assert_arity(&function_call, 1)?;
                self.emit_function_args(function_call)?;
                let func_index = self.context.resolve_builtin_function(BuiltinFunction::Sqr);

                self.push(Instruction::Call(func_index))
            }
            "bor" => {
                assert_arity(&function_call, 2)?;
                self.emit_function_args(function_call)?;
                let func_index = self
                    .context
                    .resolve_builtin_function(BuiltinFunction::LogicalOr);

                self.push(Instruction::Call(func_index))
            }
            "band" => {
                assert_arity(&function_call, 2)?;
                self.emit_function_args(function_call)?;
                let func_index = self
                    .context
                    .resolve_builtin_function(BuiltinFunction::LogicalAnd);

                self.push(Instruction::Call(func_index))
            }
            // TODO: Add a test for this
            "mod" => {
                assert_arity(&function_call, 2)?;
                self.emit_function_args(function_call)?;
                let func_index = self.context.resolve_builtin_function(BuiltinFunction::Mod);

                self.push(Instruction::Call(func_index))
            }
            "sign" => {
                assert_arity(&function_call, 1)?;
                self.emit_function_args(function_call)?;
                let func_index = self.context.resolve_builtin_function(BuiltinFunction::Sign);

                self.push(Instruction::Call(func_index))
            }
            "exec2" => {
                assert_arity(&function_call, 2)?;
                self.emit_expression_list(function_call.arguments)?
            }
            "exec3" => {
                assert_arity(&function_call, 3)?;
                self.emit_expression_list(function_call.arguments)?
            }
            "while" => {
                assert_arity(&function_call, 1)?;
                let body = function_call.arguments.pop().unwrap();
                self.emit_while(body)?;
            }
            "loop" => {
                assert_arity(&function_call, 2)?;
                let body = function_call.arguments.pop().unwrap();
                let count = function_call.arguments.pop().unwrap();
                self.emit_loop(count, body)?;
            }
            "assign" => {
                assert_arity(&function_call, 2)?;
                let value = function_call.arguments.pop().unwrap();
                let variable = function_call.arguments.pop().unwrap();
                if let Expression::Identifier(identifier) = variable {
                    let resolved_name = self.context.resolve_variable(identifier.name);
                    self.emit_expression(value)?;
                    self.push(Instruction::SetGlobal(resolved_name));
                    self.push(Instruction::GetGlobal(resolved_name));
                } else {
                    Err(CompilerError::new(
                        "Expected the first argument of `assign()` to be an identifier."
                            .to_string(),
                        // TODO: Point this to the first arg
                        function_call.name.span,
                    ))?
                }
            }
            "megabuf" => self.emit_memory_access(&mut function_call, 0)?,
            "gmegabuf" => self.emit_memory_access(&mut function_call, BUFFER_SIZE * 8)?,
            shim_name if Shim::from_str(shim_name).is_some() => {
                let shim = Shim::from_str(shim_name).unwrap();
                assert_arity(&function_call, shim.arity())?;
                self.emit_function_args(function_call)?;

                let shim_index = self.context.resolve_shim_function(shim);
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
    fn emit_function_args(&mut self, function_call: FunctionCall) -> EmitterResult<()> {
        for arg in function_call.arguments {
            self.emit_expression(arg)?;
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

        let call_index = self
            .context
            .resolve_builtin_function(BuiltinFunction::GetBufferIndex);
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

    fn emit_while(&mut self, body: Expression) -> EmitterResult<()> {
        let iteration_idx = self.resolve_local(ValueType::I32);
        self.push(Instruction::I32Const(0));
        self.push(Instruction::SetLocal(iteration_idx));

        self.push(Instruction::Loop(BlockType::NoResult));

        // Increment and check loop count
        self.push(Instruction::GetLocal(iteration_idx));
        self.push(Instruction::I32Const(1));
        self.push(Instruction::I32Add);
        self.push(Instruction::TeeLocal(iteration_idx));
        // STACK: [iteration count]
        self.push(Instruction::I32Const(MAX_LOOP_COUNT));
        self.push(Instruction::I32LtU);
        // STACK: [loop in range]
        self.emit_expression(body)?;
        self.emit_is_not_zeroish();
        // STACK: [loop in range, body is truthy]
        self.push(Instruction::I32And);
        self.push(Instruction::BrIf(0));
        self.push(Instruction::End);
        self.push(Instruction::F64Const(f64_const(0.0)));
        Ok(())
    }

    fn emit_loop(&mut self, count: Expression, body: Expression) -> EmitterResult<()> {
        let iteration_idx = self.resolve_local(ValueType::I32);
        self.push(Instruction::Block(BlockType::NoResult));
        // Assign the count to a variable
        self.emit_expression(count)?;
        self.push(Instruction::I32TruncSF64);
        self.push(Instruction::TeeLocal(iteration_idx));
        self.push(Instruction::I32Const(0));
        self.push(Instruction::I32LeS);
        self.push(Instruction::BrIf(1));
        self.push(Instruction::Loop(BlockType::NoResult));
        // Run the body
        self.emit_expression(body)?;
        self.push(Instruction::Drop);
        // Decrement the count
        self.push(Instruction::GetLocal(iteration_idx));
        self.push(Instruction::I32Const(1));
        self.push(Instruction::I32Sub);
        self.push(Instruction::TeeLocal(iteration_idx));
        self.push(Instruction::I32Const(0));
        self.push(Instruction::I32Ne);
        self.push(Instruction::BrIf(0)); // Return to the top of the loop
        self.push(Instruction::End); // End loop
        self.push(Instruction::End); // End block
        self.push(Instruction::F64Const(f64_const(0.0))); // Implicitly return zero
        Ok(())
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

    fn resolve_local(&mut self, type_: ValueType) -> u32 {
        self.locals.push(type_);
        return self.locals.len() as u32 - 1;
    }
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
