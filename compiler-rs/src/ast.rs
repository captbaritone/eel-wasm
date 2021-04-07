#[derive(Debug, PartialEq)]
pub struct Program {
    pub expression: Expression,
}

#[derive(Debug, PartialEq)]
pub enum Expression {
    BinaryExpression(BinaryExpression),
    NumberLiteral(NumberLiteral),
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
