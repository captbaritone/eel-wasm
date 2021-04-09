use crate::span::Span;

#[derive(Debug, PartialEq)]
pub struct EelFunction {
    pub expressions: ExpressionBlock,
}

#[derive(Debug, PartialEq)]
pub struct ExpressionBlock {
    pub expressions: Vec<Expression>,
}

#[derive(Debug, PartialEq)]
pub enum Expression {
    BinaryExpression(BinaryExpression),
    UnaryExpression(UnaryExpression),
    NumberLiteral(NumberLiteral),
    Assignment(Assignment),
    FunctionCall(FunctionCall),
    ExpressionBlock(ExpressionBlock),
    Identifier(Identifier),
}

#[derive(Debug, PartialEq)]
pub struct UnaryExpression {
    pub right: Box<Expression>,
    pub op: UnaryOperator,
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
    Mod,
    Eq,
    BitwiseAnd,
    BitwiseOr,
    LogicalAnd,
    Pow,
}

#[derive(Debug, PartialEq)]
pub enum UnaryOperator {
    Plus,
    Minus,
    Not,
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
