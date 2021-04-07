use crate::ast::{BinaryExpression, BinaryOperator};

use super::ast::{Expression, NumberLiteral, Program};
use super::lexer::Lexer;
use super::span::Span;
use super::tokens::{Token, TokenKind};

static SUM_PRECEDENCE: u8 = 1;
static DIFFERENCE_PRECEDENCE: u8 = 1;
static PRODUCT_PRECEDENCE: u8 = 2;
static QUOTIENT_PRECEDENCE: u8 = 2;

pub struct Parser<'a> {
    lexer: Lexer<'a>,
    token: Token<'a>,
}

impl<'a> Parser<'a> {
    pub fn new(source: &'a str) -> Self {
        Parser {
            lexer: Lexer::new(source),
            token: Token {
                kind: TokenKind::SOF,
                span: Span::start_of_file(source),
            },
        }
    }

    fn advance(&mut self) -> Result<(), String> {
        self.token = self.lexer.next_token()?;
        Ok(())
    }

    fn expect_kind(&mut self, expected: TokenKind) -> Result<(), String> {
        if self.token.kind == expected {
            self.advance()?;
            Ok(())
        } else {
            // TODO: Improve error message and improve source location.
            Err(format!(
                "Expected a {:?} but found {:?}",
                expected, self.token.kind
            ))
        }
    }

    pub fn parse(&mut self) -> Result<Program, String> {
        self.expect_kind(TokenKind::SOF)?;
        let program = self.parse_program()?;
        self.expect_kind(TokenKind::EOF)?;
        Ok(program)
    }

    pub fn parse_program(&mut self) -> Result<Program, String> {
        Ok(Program {
            expression: self.parse_expression(0)?,
        })
    }

    fn parse_expression(&mut self, precedence: u8) -> Result<Expression, String> {
        let left = self.parse_prefix()?;
        self.maybe_parse_infix(left, precedence)
    }

    fn parse_prefix(&mut self) -> Result<Expression, String> {
        match self.token.kind {
            TokenKind::Int => Ok(Expression::NumberLiteral(self.parse_int()?)),
            // TokenKind::OpenParen => self.parse_parenthesized_expression(),
            // Once we have other prefix operators: `+-!` they  will go here.
            _ => Err(format!("Expected an Int but found {:?}", self.token.kind)),
        }
    }

    fn maybe_parse_infix(
        &mut self,
        left: Expression,
        precedence: u8,
    ) -> Result<Expression, String> {
        let mut next = left;
        loop {
            next = match self.token.kind {
                TokenKind::Plus if precedence < SUM_PRECEDENCE => self.parse_sum(next)?,
                TokenKind::Minus if precedence < DIFFERENCE_PRECEDENCE => {
                    self.parse_difference(next)?
                }
                TokenKind::Asterisk if precedence < PRODUCT_PRECEDENCE => {
                    self.parse_product(next)?
                }
                TokenKind::Slash if precedence < QUOTIENT_PRECEDENCE => {
                    self.parse_quotient(next)?
                }
                _ => return Ok(next),
            }
        }
    }

    fn parse_sum(&mut self, left: Expression) -> Result<Expression, String> {
        self.expect_kind(TokenKind::Plus)?;
        let right = self.parse_expression(left_associative(SUM_PRECEDENCE))?;
        Ok(Expression::BinaryExpression(BinaryExpression {
            left: Box::new(left),
            right: Box::new(right),
            op: BinaryOperator::Add,
        }))
    }

    fn parse_difference(&mut self, left: Expression) -> Result<Expression, String> {
        self.expect_kind(TokenKind::Minus)?;
        let right = self.parse_expression(left_associative(DIFFERENCE_PRECEDENCE))?;
        Ok(Expression::BinaryExpression(BinaryExpression {
            left: Box::new(left),
            right: Box::new(right),
            op: BinaryOperator::Subtract,
        }))
    }

    fn parse_product(&mut self, left: Expression) -> Result<Expression, String> {
        self.expect_kind(TokenKind::Asterisk)?;
        let right = self.parse_expression(left_associative(PRODUCT_PRECEDENCE))?;
        Ok(Expression::BinaryExpression(BinaryExpression {
            left: Box::new(left),
            right: Box::new(right),
            op: BinaryOperator::Multiply,
        }))
    }

    fn parse_quotient(&mut self, left: Expression) -> Result<Expression, String> {
        self.expect_kind(TokenKind::Slash)?;
        let right = self.parse_expression(left_associative(QUOTIENT_PRECEDENCE))?;
        Ok(Expression::BinaryExpression(BinaryExpression {
            left: Box::new(left),
            right: Box::new(right),
            op: BinaryOperator::Divide,
        }))
    }

    fn parse_int(&mut self) -> Result<NumberLiteral, String> {
        if let TokenKind::Int = self.token.kind {
            let value = self.token.span.str_from_source();
            match value.parse() {
                Ok(value) => {
                    self.advance()?;
                    Ok(NumberLiteral { value })
                }
                Err(_) => Err(format!("Could not parse \"{}\" to a number", value)),
            }
        } else {
            Err(format!("Expected an Int but found {:?}", self.token.kind))
        }
    }
}

#[inline]
#[allow(dead_code)] // Save this for when we need it.
fn left_associative(precedence: u8) -> u8 {
    precedence
}

#[inline]
#[allow(dead_code)] // Save this for when we need it.
fn right_associative(precedence: u8) -> u8 {
    precedence - 1
}

#[test]
fn can_parse_integer() {
    assert_eq!(
        Parser::new("1").parse(),
        Ok(Program {
            expression: Expression::NumberLiteral(NumberLiteral { value: 1 })
        })
    );
}

#[test]
fn can_parse_integer_2() {
    assert_eq!(
        Parser::new("2").parse(),
        Ok(Program {
            expression: Expression::NumberLiteral(NumberLiteral { value: 2 })
        })
    );
}