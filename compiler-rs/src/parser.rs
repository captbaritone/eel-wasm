use std::num::ParseFloatError;

use crate::ast::{
    Assignment, AssignmentOperator, AssignmentTarget, BinaryExpression, BinaryOperator,
    ExpressionBlock, FunctionCall, Identifier, UnaryExpression, UnaryOperator,
};

use super::ast::{EelFunction, Expression, NumberLiteral};
use super::error::CompilerError;
use super::lexer::Lexer;
use super::span::Span;
use super::tokens::{Token, TokenKind};

// https://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/
static ASSIGNMENT_PRECEDENCE: u8 = 1;
// static CONDITIONAL_PRECEDENCE: u8 = 2;
static SUM_PRECEDENCE: u8 = 3;
static DIFFERENCE_PRECEDENCE: u8 = 3;
static PRODUCT_PRECEDENCE: u8 = 4;
static QUOTIENT_PRECEDENCE: u8 = 4;
static EXPONENTIATION_PRECEDENCE: u8 = 5;
static MOD_PRECEDENCE: u8 = 5; // A little strange, in JS this would match product/quotient
static PREFIX_PRECEDENCE: u8 = 6;
// static POSTFIX_PRECEDENCE: u8 = 7;
// static CALL_PRECEDENCE: u8 = 8;

struct Parser<'a> {
    lexer: Lexer<'a>,
    token: Token,
}

type ParseResult<T> = Result<T, CompilerError>;

pub fn parse(src: &str) -> ParseResult<EelFunction> {
    let mut parser = Parser::new(&src);
    parser.parse()
}

impl<'a> Parser<'a> {
    pub fn new(source: &'a str) -> Self {
        Parser {
            lexer: Lexer::new(source),
            token: Token {
                kind: TokenKind::SOF,
                span: Span::empty(),
            },
        }
    }

    fn advance(&mut self) -> ParseResult<()> {
        self.token = self.lexer.next_token()?;
        Ok(())
    }

    fn expect_kind(&mut self, expected: TokenKind) -> ParseResult<()> {
        let token = self.peek();
        if token.kind == expected {
            self.advance()?;
            Ok(())
        } else {
            Err(CompilerError::new(
                format!("Expected a {:?} but found {:?}", expected, self.token.kind),
                token.span,
            ))
        }
    }

    pub fn parse(&mut self) -> ParseResult<EelFunction> {
        self.expect_kind(TokenKind::SOF)?;
        let program = self.parse_program()?;
        self.expect_kind(TokenKind::EOF)?;
        Ok(program)
    }

    pub fn parse_program(&mut self) -> ParseResult<EelFunction> {
        Ok(EelFunction {
            expressions: self.parse_expression_block()?,
        })
    }

    pub fn parse_expression_block(&mut self) -> ParseResult<ExpressionBlock> {
        let mut expressions = vec![];
        while self.peek_expression() {
            expressions.push(self.parse_expression(0)?);
            // TODO: This is probably not quite right. We should require semis between expressions.
            while self.peek().kind == TokenKind::Semi {
                self.advance()?;
            }
        }
        Ok(ExpressionBlock { expressions })
    }

    fn peek_expression(&self) -> bool {
        self.peek_prefix()
    }

    fn parse_expression(&mut self, precedence: u8) -> ParseResult<Expression> {
        let left = self.parse_prefix()?;
        self.maybe_parse_infix(left, precedence)
    }

    fn peek_prefix(&self) -> bool {
        let token = self.peek();
        match token.kind {
            TokenKind::OpenParen => true,
            TokenKind::Int => true,
            TokenKind::Plus => true,
            TokenKind::Minus => true,
            TokenKind::Bang => true,
            TokenKind::Identifier => true,
            _ => false,
        }
    }

    fn parse_prefix(&mut self) -> ParseResult<Expression> {
        match self.token.kind {
            TokenKind::OpenParen => {
                self.advance()?;
                let expression_block = self.parse_expression_block()?;
                self.expect_kind(TokenKind::CloseParen)?;
                Ok(Expression::ExpressionBlock(expression_block))
            }
            TokenKind::Int => Ok(Expression::NumberLiteral(self.parse_int()?)),
            TokenKind::Plus => {
                self.advance()?;
                Ok(Expression::UnaryExpression(UnaryExpression {
                    right: Box::new(self.parse_expression(PREFIX_PRECEDENCE)?),
                    op: UnaryOperator::Plus,
                }))
            }
            TokenKind::Minus => {
                self.advance()?;
                Ok(Expression::UnaryExpression(UnaryExpression {
                    right: Box::new(self.parse_expression(PREFIX_PRECEDENCE)?),
                    op: UnaryOperator::Minus,
                }))
            }
            TokenKind::Bang => {
                self.advance()?;
                Ok(Expression::UnaryExpression(UnaryExpression {
                    right: Box::new(self.parse_expression(PREFIX_PRECEDENCE)?),
                    op: UnaryOperator::Not,
                }))
            }
            // TokenKind::OpenParen => self.parse_parenthesized_expression(),
            // Once we have other prefix operators: `+-!` they  will go here.
            TokenKind::Identifier => self.parse_identifier_expression(),
            _ => Err(CompilerError::new(
                format!("Expected Int or Identifier but got {:?}", self.token.kind),
                self.token.span,
            )),
        }
    }

    fn maybe_parse_infix(&mut self, left: Expression, precedence: u8) -> ParseResult<Expression> {
        let mut next = left;
        loop {
            let (precedence, op) = match self.token.kind {
                TokenKind::Plus if precedence < SUM_PRECEDENCE => {
                    (left_associative(SUM_PRECEDENCE), BinaryOperator::Add)
                }
                TokenKind::Minus if precedence < DIFFERENCE_PRECEDENCE => (
                    left_associative(DIFFERENCE_PRECEDENCE),
                    BinaryOperator::Subtract,
                ),
                TokenKind::Asterisk if precedence < PRODUCT_PRECEDENCE => (
                    left_associative(PRODUCT_PRECEDENCE),
                    BinaryOperator::Multiply,
                ),
                TokenKind::Slash if precedence < QUOTIENT_PRECEDENCE => (
                    left_associative(QUOTIENT_PRECEDENCE),
                    BinaryOperator::Divide,
                ),
                TokenKind::Percent if precedence < MOD_PRECEDENCE => {
                    (left_associative(MOD_PRECEDENCE), BinaryOperator::Mod)
                }
                // TODO: prededence?
                TokenKind::DoubleEqual if precedence < ASSIGNMENT_PRECEDENCE => {
                    (left_associative(ASSIGNMENT_PRECEDENCE), BinaryOperator::Eq)
                }
                TokenKind::OpenAngel => (0, BinaryOperator::LessThan),
                TokenKind::CloseAngel => (0, BinaryOperator::GreaterThan),
                TokenKind::LTEqual => (0, BinaryOperator::LessThanEqual),
                TokenKind::GTEqual => (0, BinaryOperator::GreaterThanEqual),
                TokenKind::NotEqual => (0, BinaryOperator::NotEqual),
                TokenKind::And => (0, BinaryOperator::BitwiseAnd),
                TokenKind::AndAnd => (0, BinaryOperator::LogicalAnd),
                TokenKind::PipePipe => (0, BinaryOperator::LogicalOr),
                TokenKind::Pipe => (0, BinaryOperator::BitwiseOr),
                TokenKind::Caret if precedence < EXPONENTIATION_PRECEDENCE => (
                    left_associative(EXPONENTIATION_PRECEDENCE),
                    BinaryOperator::Pow,
                ),
                _ => return Ok(next),
            };

            self.advance()?;

            let right = self.parse_expression(precedence)?;
            next = Expression::BinaryExpression(BinaryExpression {
                left: Box::new(next),
                right: Box::new(right),
                op,
            });
        }
    }

    fn parse_int(&mut self) -> ParseResult<NumberLiteral> {
        if let TokenKind::Int = self.token.kind {
            let value = self.lexer.source(self.token.span);
            match parse_number(value) {
                Ok(value) => {
                    self.advance()?;
                    Ok(NumberLiteral { value })
                }
                Err(_) => Err(CompilerError::new(
                    format!("Could not parse \"{}\" to a number", value),
                    self.token.span,
                )),
            }
        } else {
            Err(CompilerError::new(
                format!("Expected an Int but found {:?}", self.token.kind),
                self.token.span,
            ))
        }
    }

    fn parse_identifier(&mut self) -> ParseResult<Identifier> {
        let span = self.token.span;
        self.expect_kind(TokenKind::Identifier)?;
        Ok(Identifier {
            name: self.lexer.source(span).to_lowercase(),
            span,
        })
    }

    fn parse_identifier_assignment(
        &mut self,
        target: AssignmentTarget,
        operator: AssignmentOperator,
    ) -> ParseResult<Expression> {
        self.advance()?;
        let right = self.parse_expression(0)?;
        Ok(Expression::Assignment(Assignment {
            left: target,
            operator,
            right: Box::new(right),
        }))
    }

    fn parse_assignment_tail(&mut self, left: AssignmentTarget) -> ParseResult<Expression> {
        match self.token.kind {
            TokenKind::Equal => self.parse_identifier_assignment(left, AssignmentOperator::Equal),
            TokenKind::PlusEqual => {
                self.parse_identifier_assignment(left, AssignmentOperator::PlusEqual)
            }
            TokenKind::MinusEqual => {
                self.parse_identifier_assignment(left, AssignmentOperator::MinusEqual)
            }
            TokenKind::TimesEqual => {
                self.parse_identifier_assignment(left, AssignmentOperator::TimesEqual)
            }
            TokenKind::DivEqual => {
                self.parse_identifier_assignment(left, AssignmentOperator::DivEqual)
            }
            TokenKind::ModEqual => {
                self.parse_identifier_assignment(left, AssignmentOperator::ModEqual)
            }
            _ => {
                // If you hit this, peek_assignment is wrong.
                Err(CompilerError::new(
                    "Unexpected assignment token".to_string(),
                    Span::empty(),
                ))
            }
        }
    }

    fn peek_assignment(&self) -> bool {
        match self.token.kind {
            TokenKind::Equal
            | TokenKind::PlusEqual
            | TokenKind::MinusEqual
            | TokenKind::TimesEqual
            | TokenKind::DivEqual
            | TokenKind::ModEqual => true,
            _ => false,
        }
    }

    fn parse_function_call(&mut self, name: Identifier) -> ParseResult<Expression> {
        self.advance()?;
        let mut arguments = vec![];
        while self.peek_expression() {
            arguments.push(self.parse_expression(0)?);
            match self.peek().kind {
                TokenKind::Comma => self.advance()?,
                TokenKind::CloseParen => {
                    self.advance()?;
                    break;
                }
                _ => {
                    return Err(CompilerError::new(
                        "Expected , or )".to_string(),
                        self.token.span,
                    ))
                }
            }
        }
        let function_call = FunctionCall { name, arguments };

        if self.peek_assignment() {
            self.parse_assignment_tail(AssignmentTarget::FunctionCall(function_call))
        } else {
            Ok(Expression::FunctionCall(function_call))
        }
    }

    fn parse_identifier_expression(&mut self) -> ParseResult<Expression> {
        let identifier = self.parse_identifier()?;

        if self.peek_assignment() {
            return self.parse_assignment_tail(AssignmentTarget::Identifier(identifier));
        }

        match &self.token.kind {
            TokenKind::OpenParen => self.parse_function_call(identifier),
            _ => Ok(Expression::Identifier(identifier)),
        }
    }

    fn peek(&self) -> &Token {
        &self.token
    }
}

fn parse_number(raw: &str) -> Result<f64, ParseFloatError> {
    if raw.starts_with('.') {
        format!("0{}", raw).parse::<f64>()
    } else {
        raw.parse::<f64>()
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
        Ok(EelFunction {
            expressions: ExpressionBlock {
                expressions: vec![Expression::NumberLiteral(NumberLiteral { value: 1.0 })]
            }
        })
    );
}

#[test]
fn can_parse_integer_2() {
    assert_eq!(
        Parser::new("2").parse(),
        Ok(EelFunction {
            expressions: ExpressionBlock {
                expressions: vec![Expression::NumberLiteral(NumberLiteral { value: 2.0 })]
            }
        })
    );
}
