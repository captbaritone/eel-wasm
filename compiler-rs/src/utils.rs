// TODO: There's got to be a better way.
pub fn f64_const(value: f64) -> u64 {
    u64::from_le_bytes(value.to_le_bytes())
}
