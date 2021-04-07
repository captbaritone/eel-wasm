use crate::span::Span;

#[derive(Debug, PartialEq)]
pub struct EelFunction {
    pub expressions: Vec<Expression>,
}

#[derive(Debug, PartialEq)]
pub enum Expression {
    BinaryExpression(BinaryExpression),
    NumberLiteral(NumberLiteral),
    Assignment(Assignment),
    FunctionCall(FunctionCall),
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpression {
    pub left: Box<Expression>,
    pub right: Box<Expression>,
    pub op: BinaryOperator,
}

#[derive(Debug, PartialEq)]
pub struct NumberLiteral {
    pub value: f64,
}

#[derive(Debug, PartialEq)]
pub enum BinaryOperator {
    Add,
    Subtract,
    Multiply,
    Divide,
}

#[derive(Debug, PartialEq)]
pub struct Identifier {
    pub name: String,
    pub span: Span,
}

#[derive(Debug, PartialEq)]
pub enum AssignmentOperator {
    Equal,
}

#[derive(Debug, PartialEq)]
pub struct Assignment {
    pub left: Identifier,
    pub operator: AssignmentOperator,
    pub right: Box<Expression>,
}

#[derive(Debug, PartialEq)]
pub struct FunctionCall {
    pub name: Identifier,
    pub arguments: Vec<Expression>,
}
