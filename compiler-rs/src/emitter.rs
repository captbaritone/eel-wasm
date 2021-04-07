use std::io;

use crate::{
    ast::{BinaryExpression, BinaryOperator, NumberLiteral},
    ops::opcodes,
};

use super::ast::{Expression, Program};

#[derive(Debug, Clone)]
pub enum Error {
    HeapOther(String),
}

impl From<io::Error> for Error {
    fn from(err: io::Error) -> Self {
        Error::HeapOther(format!("I/O Error: {:?}", err))
    }
}

pub trait Serialize {
    /// Serialization error produced by serialization routine.
    type Error: From<io::Error>;
    /// Serialize type to serial i/o
    fn serialize<W: io::Write>(self, writer: &mut W) -> Result<(), Self::Error>;
}

impl Serialize for Program {
    type Error = Error;
    fn serialize<W: io::Write>(self, writer: &mut W) -> Result<(), Self::Error> {
        self.expression.serialize(writer)
    }
}

impl Serialize for Expression {
    type Error = Error;
    fn serialize<W: io::Write>(self, writer: &mut W) -> Result<(), Self::Error> {
        match self {
            Self::NumberLiteral(number) => number.serialize(writer),
            Self::BinaryExpression(binary_expression) => binary_expression.serialize(writer),
        }
    }
}

impl Serialize for NumberLiteral {
    type Error = Error;
    fn serialize<W: io::Write>(self, writer: &mut W) -> Result<(), Self::Error> {
        self.value.serialize(writer)
    }
}

impl Serialize for BinaryExpression {
    type Error = Error;
    fn serialize<W: io::Write>(self, writer: &mut W) -> Result<(), Self::Error> {
        self.left.serialize(writer)?;
        self.right.serialize(writer)?;
        self.op.serialize(writer)?;

        Ok(())
    }
}

impl Serialize for BinaryOperator {
    type Error = Error;
    fn serialize<W: io::Write>(self, writer: &mut W) -> Result<(), Self::Error> {
        match self {
            Self::Add => opcodes::F64ADD.serialize(writer),
            Self::Subtract => opcodes::F64SUB.serialize(writer),
            Self::Multiply => opcodes::F64MUL.serialize(writer),
        }
    }
}

impl Serialize for u8 {
    type Error = Error;
    fn serialize<W: io::Write>(self, writer: &mut W) -> Result<(), Self::Error> {
        writer
            .write(&[self])
            .map_err(|err| Error::HeapOther(err.to_string()))?;
        Ok(())
    }
}

impl Serialize for u64 {
    type Error = Error;
    fn serialize<W: io::Write>(self, writer: &mut W) -> Result<(), Self::Error> {
        let mut buf = [0u8; 1];
        let mut v = self;
        loop {
            buf[0] = (v & 0b0111_1111) as u8;
            v >>= 7;
            if v > 0 {
                buf[0] |= 0b1000_0000;
            }
            writer.write(&buf[..])?;
            if v == 0 {
                break;
            }
        }

        Ok(())
    }
}
