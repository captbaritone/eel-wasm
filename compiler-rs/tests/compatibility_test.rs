use eel_wasm::compile;
use wasmi::{ImportsBuilder, ModuleInstance, NopExternals, RuntimeValue};

fn run(body: &[u8]) -> Result<f64, String> {
    let wasm_binary = body;
    let module = wasmi::Module::from_buffer(&wasm_binary).expect("failed to load wasm");
    let instance = ModuleInstance::new(&module, &ImportsBuilder::default())
        .expect("failed to instantiate wasm module")
        .assert_no_start();

    // Finally, invoke the exported function "test" with no parameters
    // and empty external function executor.
    match instance
        .invoke_export("test", &[], &mut NopExternals)
        .expect("failed to execute export")
    {
        Some(RuntimeValue::F64(val)) => Ok(val.into()),
        Some(val) => Err(format!("Unexpected return type: {:?}", val)),
        None => Err("No Result".to_string()),
    }
}

#[test]
fn compatibility_tests() {
    let test_cases: &[(&'static str, &'static str, f64)] = &[
        ("[REMOVE] Integer", "1", 1.0),
        ("[REMOVE] Assignment", "g=1", 1.0),
        ("Expressions", "g = ((6- -7.0)+ 3.0);", 16.0),
        ("Number", "g = 5;", 5.0),
        ("Number with decimal", "g = 5.5;", 5.5),
        ("Number with decimal and no leading whole", "g = .5;", 0.5),
        ("Number with decimal and no trailing dec", "g = 5.;", 5.0),
        ("Number with no digits", "g = .;", 0.0),
        ("Optional final semi", "(g = 5; g = 10.0);", 10.0),
        ("Unary negeation", "g = -10;", -10.0),
        ("Unary plus", "g = +10;", 10.0),
        ("Unary not true", "g = !10;", 0.0),
        ("Unary not false", "g = !0;", 1.0),
        ("Unary not 0.1", "g = !0.1;", 0.0),
        ("Unary not < epsilon", "g = !0.000009;", 1.0),
        ("Multiply", "g = 10 * 10;", 100.0),
        ("Divide", "g = 10 / 10;", 1.0),
        ("Mod", "g = 5 % 2;", 1.0),
        ("Mod zero", "g = 5 % 0;", 0.0),
        ("Bitwise and", "g = 3 & 5;", 1.0),
        ("Bitwise or", "g = 3 | 5;", 7.0),
        ("To the power", "g = 5 ^ 2;", 25.0),
        ("Order of operations (+ and *)", "g = 1 + 1 * 10;", 11.0),
        ("Order of operations (+ and /)", "g = 1 + 1 / 10;", 1.1),
        ("Order of operations (unary - and +)", "g = -1 + 1;", 0.0),
        ("Parens", "g = (1 + 1.0) * 10;", 20.0),
        ("Absolute value negative", "g = abs(-10);", 10.0),
        ("Absolute value positive", "g = abs(10);", 10.0),
        ("Function used as expression", "g = 1 + abs(-10);", 11.0),
        ("Min", "g = min(2, 10.0);", 2.0),
        ("Min reversed", "g = min(10, 2.0);", 2.0),
        ("Max", "g = max(2, 10.0);", 10.0),
        ("Max reversed", "g = max(10, 2.0);", 10.0),
        ("Sqrt", "g = sqrt(4);", 2.0),
        ("Sqrt (negative)", "g = sqrt(-4);", 2.0),
        ("Sqr", "g = sqr(10);", 100.0),
        ("Int", "g = int(4.5);", 4.0),
        ("Sin", "g = sin(10);", 10.0_f64.cos()),
        ("Cos", "g = cos(10);", 10.0_f64.cos()),
        ("Tan", "g = tan(10);", 10.0_f64.tan()),
        ("Asin", "g = asin(0.5);", 0.5_f64.asin()),
        ("Acos", "g = acos(0.5);", 0.5_f64.acos()),
        ("Atan", "g = atan(0.5);", 0.5_f64.atan()),
        ("Atan2", "g = atan2(1, 1.0);", 1_f64.atan2(1.0)),
        ("Assign to globals", "g = 10;", 10.0),
        ("Read globals", "g = x;", 10.0),
        ("Multiple statements", "g = 10; g = 20;", 20.0),
        ("Multiple statements expression", "(g = 10; g = 20;);", 20.0),
        (
            "Multiple statements expression implcit return",
            "g = (0; 20 + 5;);",
            25.0,
        ),
        ("if", "g = if(0, 20, 10.0);", 10.0),
        ("if", "g = if(0, 20, 10.0);", 10.0),
        (
            "if does short-circit (consiquent)",
            "if(0, (g = 10;), 10.0);",
            0.0,
        ),
        (
            "if does short-circit (alternate)",
            "if(1, (10), (g = 10;));",
            0.0,
        ),
        ("above (true)", "g = above(10, 4.0);", 1.0),
        ("above (false)", "g = above(4, 10.0);", 0.0),
        ("below (true)", "g = below(4, 10.0);", 1.0),
        ("below (false)", "g = below(10, 4.0);", 0.0),
        ("Line comments", "g = 10; // g = 20;", 10.0),
        ("Line comments (\\\\)", "g = 10; \\\\ g = 20;", 10.0),
        ("Equal (false)", "g = equal(10, 5.0);", 0.0),
        ("Equal (true)", "g = equal(10, 10.0);", 1.0),
        ("Pow", "g = pow(2, 10.0);", 1024.0),
        ("Log", "g = log(10);", 10_f64.log(std::f64::consts::E)),
        ("Log10", "g = log10(10);", 10_f64.log10()),
        ("Sign (10)", "g = sign(10);", 1.0),
        ("Sign (-10)", "g = sign(-10);", -1.0),
        ("Sign (0)", "g = sign(0);", 0.0),
        ("Sign (-0)", "g = sign(-0);", 0.0),
        ("Local variables", "a = 10; g = a * a;", 100.0),
        (
            "Local variable assignment (implicit return)",
            "g = a = 10;",
            10.0,
        ),
        ("Bor (true, false)", "g = bor(10, 0.0);", 1.0),
        ("Bor (false, true)", "g = bor(0, 2.0);", 1.0),
        ("Bor (true, true)", "g = bor(1, 7.0);", 1.0),
        ("Bor (false, false)", "g = bor(0, 0.0);", 0.0),
        ("Bor does not shortcircut", "bor(1, g = 10.0);", 10.0),
        ("Bor respects epsilon", "g = bor(0.000009, 0.000009);", 0.0),
        ("Band (true, false)", "g = band(10, 0.0);", 0.0),
        ("Band (false, true)", "g = band(0, 2.0);", 0.0),
        ("Band (true, true)", "g = band(1, 7.0);", 1.0),
        ("Band (false, false)", "g = band(0, 0.0);", 0.0),
        ("Band does not shortcircut", "band(0, g = 10.0);", 10.0),
        (
            "Band respects epsilon",
            "g = band(0.000009, 0.000009);",
            0.0,
        ),
        ("Bnot (true)", "g = bnot(10);", 0.0),
        ("Bnot (false)", "g = bnot(0);", 1.0),
        ("Bnot 0.1", "g = bnot(0.1);", 0.0),
        ("Bnot < epsilon", "g = bnot(0.000009);", 1.0),
        ("Plus equals", "g = 5; g += 5;", 10.0),
        ("Plus equals (local var)", "a = 5; a += 5; g = a;", 10.0),
        ("Plus equals (megabuf)", "g = megabuf(0) += 5;", 5.0),
        ("Minus equals", "g = 5; g -= 4;", 1.0),
        ("Minus equals (local var)", "a = 5; a -= 4; g = a;", 1.0),
        ("Minus equals (megabuf)", "g = megabuf(0) -= 5;", -5.0),
        ("Times equals", "g = 5; g *= 4;", 20.0),
        ("Times equals (local var)", "a = 5; a *= 4; g = a;", 20.0),
        (
            "Times equals (megabuf)",
            "g = (megabuf(0) = 9; megabuf(0) *= 2.0);",
            18.0,
        ),
        ("Divide equals", "g = 5; g /= 2;", 2.5),
        ("Divide equals (local var)", "a = 5; a /= 2; g = a;", 2.5),
        (
            "Divide equals (megabuf)",
            "g = (megabuf(0) = 8; megabuf(0) /= 2.0);",
            4.0,
        ),
        ("Mod equals", "g = 5; g %= 2;", 1.0),
        ("Mod equals (local var)", "a = 5; a %= 2; g = a;", 1.0),
        (
            "Mod equals (megabuf)",
            "g = (megabuf(0) = 5; megabuf(0) %= 2.0);",
            1.0,
        ),
        (
            "Statement block as argument",
            "g = int(g = 5; g + 10.5;);",
            15.0,
        ),
        ("Logical and (both true)", "g = 10 && 2;", 1.0),
        (
            "Logical and does not run the left twice",
            "(g = g + 1; 0;) && 10;",
            1.0,
        ),
        ("Logical and (first value false)", "g = 0 && 2;", 0.0),
        ("Logical and (second value false)", "g = 2 && 0;", 0.0),
        ("Logical or (both true)", "g = 10 || 2;", 1.0),
        ("Logical or (first value false)", "g = 0 || 2;", 1.0),
        ("Logical and shortcircuts", "0 && g = 10;", 0.0),
        ("Logical or shortcircuts", "1 || g = 10;", 0.0),
        ("Exec2", "g = exec2(x = 5, x * 3.0);", 15.0),
        ("Exec3", "g = exec3(x = 5, x = x * 3, x + 1.0);", 16.0),
        ("While", "while(exec2(g = g + 1, g - 10.0));", 10.0),
        ("Loop", "loop(10, g = g + 1.0);", 10.0),
        ("Loop fractional times", "loop(1.5, g = g + 1.0);", 1.0),
        ("Loop zero times", "loop(0, g = g + 1.0);", 0.0),
        ("Loop negative times", "loop(-2, g = g + 1.0);", 0.0),
        (
            "Loop negative fractional times",
            "loop(-0.2, g = g + 1.0);",
            0.0,
        ),
        ("Equality (true)", "g = 1 == 1;", 1.0),
        ("Equality epsilon", "g = 0 == 0.000009;", 1.0),
        ("!Equality (true)", "g = 1 != 0;", 1.0),
        ("!Equality (false)", "g = 1 != 1;", 0.0),
        ("!Equality epsilon", "g = 0 != 0.000009;", 0.0),
        ("Equality (false)", "g = 1 == 0;", 0.0),
        ("Less than (true)", "g = 1 < 2;", 1.0),
        ("Less than (false)", "g = 2 < 1;", 0.0),
        ("Greater than (true)", "g = 2 > 1;", 1.0),
        ("Greater than (false)", "g = 1 > 2;", 0.0),
        ("Less than or equal (true)", "g = 1 <= 2;", 1.0),
        ("Less than or equal (false)", "g = 2 <= 1;", 0.0),
        ("Greater than or equal (true)", "g = 2 >= 1;", 1.0),
        ("Greater than or equal (false)", "g = 1 >= 2;", 0.0),
        ("Script without trailing semi", "g = 1", 1.0),
        ("Megabuf access", "g = megabuf(1);", 0.0),
        (
            "Max index megabuf",
            "megabuf(8388607) = 10; g = megabuf(8388607);",
            10.0,
        ),
        (
            "Max index + 1 megabuf",
            "megabuf(8388608) = 10; g = megabuf(8388608);",
            0.0,
        ),
        (
            "Max index gmegabuf",
            "gmegabuf(8388607) = 10; g = gmegabuf(8388607);",
            10.0,
        ),
        (
            "Max index+1 gmegabuf",
            "gmegabuf(8388608) = 10; g = gmegabuf(8388608);",
            0.0,
        ),
        (
            "Megabuf assignment",
            "megabuf(1) = 10; g = megabuf(1);",
            10.0,
        ),
        (
            "Megabuf assignment (idx 100.0)",
            "megabuf(100) = 10; g = megabuf(100);",
            10.0,
        ),
        ("Megabuf (float)", "megabuf(0) = 1.2; g = megabuf(0);", 1.2),
        ("Gmegabuf", "gmegabuf(0) = 1.2; g = gmegabuf(0);", 1.2),
        (
            "Megabuf != Gmegabuf",
            "gmegabuf(0) = 1.2; g = megabuf(0);",
            0.0,
        ),
        (
            "Gmegabuf != Megabuf",
            "megabuf(0) = 1.2; g = gmegabuf(0);",
            0.0,
        ),
        ("Case insensitive vars", "G = 10;", 10.0),
        ("Case insensitive funcs", "g = InT(10);", 10.0),
        ("Consecutive semis", "g = 10;;; ;g = 20;;", 20.0),
        ("Equality (< epsilon)", "g = 0.000009 == 0;", 1.0),
        ("Equality (< -epsilon)", "g = -0.000009 == 0;", 1.0),
        ("Variables don't collide", "g = 1; not_g = 2;", 1.0),
        ("Block comment", "g = 1; /* g = 10 */ g = g * 2;", 2.0),
        ("Sigmoid 1, 2", "g = sigmoid(1, 2.0);", 0.8807970779778823),
        ("Sigmoid 2, 1", "g = sigmoid(2, 1.0);", 0.8807970779778823),
        ("Sigmoid 0, 0", "g = sigmoid(0, 0.0);", 0.5),
        ("Sigmoid 10, 10", "g = sigmoid(10, 10.0);", 1.0),
        ("Exp", "g = exp(10);", 10_f64.exp()),
        ("Floor", "g = floor(10.9);", 10.0),
        ("Floor", "g = floor(-10.9);", -11.0),
        ("Ceil", "g = ceil(9.1);", 10.0),
        ("Ceil", "g = ceil(-9.9);", -9.0),
        ("Assign", "assign(g, 10.0);", 10.0),
        ("Assign return value", "g = assign(x, 10.0);", 10.0),
        (
            "EPSILON buffer indexes",
            "megabuf(9.99999) = 10; g = megabuf(10)",
            10.0,
        ),
        (
            "+EPSILON & rounding -#s toward 0",
            "megabuf(-1) = 10; g = megabuf(0)",
            10.0,
        ),
        ("Negative buffer index read as 0", "g = megabuf(-2);", 0.0),
        ("Negative buffer index", "g = (megabuf(-2) = 20.0);", 0.0),
        (
            "Negative buffer index gmegabuf",
            "g = (gmegabuf(-2) = 20.0);",
            0.0,
        ),
        (
            "Negative buf index execs right hand side",
            "megabuf(-2) = (g = 10.0);",
            10.0,
        ),
        ("Negative buf index +=", "g = megabuf(-2) += 10;", 10.0),
        ("Negative buf index -=", "g = megabuf(-2) -= 10;", -10.0),
        ("Negative buf index *=", "g = megabuf(-2) *= 10;", 0.0),
        ("Negative buf index /=", "g = megabuf(-2) /= 10;", 0.0),
        ("Negative buf index %=", "g = megabuf(-2) %= 10;", 0.0),
        (
            "Buff += mutates",
            "megabuf(100) += 10; g = megabuf(100)",
            10.0,
        ),
        (
            "Buffers don't collide",
            "megabuf(100) = 10; g = gmegabuf(100)",
            0.0,
        ),
        (
            "gmegabuf does not write megabuf",
            "i = 100; loop(10000,gmegabuf(i) = 10; i += 1.0); g = megabuf(100)",
            0.0,
        ),
        (
            "megabuf does not write gmegabuf",
            "i = 100; loop(10000,megabuf(i) = 10; i += 1.0); g = gmegabuf(100)",
            0.0,
        ),
        (
            "Adjacent buf indicies don't collide",
            "megabuf(99) = 10; megabuf(100) = 1; g = megabuf(99)",
            10.0,
        ),
        ("Exponentiation associativity", "g = 2 ^ 2 ^ 4", 256.0),
        (
            "^ has lower precedence than * (left)",
            "g = 2 ^ 2 * 4",
            16.0,
        ),
        (
            "^ has lower precedence than * (right)",
            "g = 2 * 2 ^ 4",
            32.0,
        ),
        (
            "% has lower precedence than * (right)",
            "g = 2 * 5 % 2",
            2.0,
        ),
        ("% has lower precedence than * (left)", "g = 2 % 5 * 2", 4.0),
        (
            "% and ^ have the same precedence (% first)",
            "g = 2 % 5 ^ 2",
            4.0,
        ),
        (
            "% and ^ have the same precedence (^ first)",
            "g = 2 ^ 5 % 2",
            0.0,
        ),
        ("Loop limit", "g = 0; while(g = g + 1.0)", 1048576.0),
        ("Divide by zero", "g = 100 / 0", 0.0),
        (
            "Divide by less than epsilon",
            "g = 100 / 0.000001",
            100000000.0,
        ),
    ];

    let expected_failing: Vec<&str> = vec![
        "Expressions",
        "Number",
        "Number with decimal",
        "Number with decimal and no leading whole",
        "Number with decimal and no trailing dec",
        "Number with no digits",
        "Optional final semi",
        "Unary negeation",
        "Unary plus",
        "Unary not true",
        "Unary not false",
        "Unary not 0.1",
        "Unary not < epsilon",
        "Multiply",
        "Divide",
        "Mod",
        "Mod zero",
        "Bitwise and",
        "Bitwise or",
        "To the power",
        "Order of operations (+ and *)",
        "Order of operations (+ and /)",
        "Order of operations (unary - and +)",
        "Parens",
        "Absolute value negative",
        "Absolute value positive",
        "Function used as expression",
        "Min",
        "Min reversed",
        "Max",
        "Max reversed",
        "Sqrt",
        "Sqrt (negative)",
        "Sqr",
        "Int",
        "Sin",
        "Cos",
        "Tan",
        "Asin",
        "Acos",
        "Atan",
        "Atan2",
        "Assign to globals",
        "Read globals",
        "Multiple statements",
        "Multiple statements expression",
        "Multiple statements expression implcit return",
        "if",
        "if",
        "if does short-circit (consiquent)",
        "if does short-circit (alternate)",
        "above (true)",
        "above (false)",
        "below (true)",
        "below (false)",
        "Line comments",
        "Line comments (\\\\)",
        "Equal (false)",
        "Equal (true)",
        "Pow",
        "Log",
        "Log10",
        "Sign (10)",
        "Sign (-10)",
        "Sign (0)",
        "Sign (-0)",
        "Local variables",
        "Local variable assignment (implicit return)",
        "Bor (true, false)",
        "Bor (false, true)",
        "Bor (true, true)",
        "Bor (false, false)",
        "Bor does not shortcircut",
        "Bor respects epsilon",
        "Band (true, false)",
        "Band (false, true)",
        "Band (true, true)",
        "Band (false, false)",
        "Band does not shortcircut",
        "Band respects epsilon",
        "Bnot (true)",
        "Bnot (false)",
        "Bnot 0.1",
        "Bnot < epsilon",
        "Plus equals",
        "Plus equals (local var)",
        "Plus equals (megabuf)",
        "Minus equals",
        "Minus equals (local var)",
        "Minus equals (megabuf)",
        "Times equals",
        "Times equals (local var)",
        "Times equals (megabuf)",
        "Divide equals",
        "Divide equals (local var)",
        "Divide equals (megabuf)",
        "Mod equals",
        "Mod equals (local var)",
        "Mod equals (megabuf)",
        "Statement block as argument",
        "Logical and (both true)",
        "Logical and does not run the left twice",
        "Logical and (first value false)",
        "Logical and (second value false)",
        "Logical or (both true)",
        "Logical or (first value false)",
        "Logical and shortcircuts",
        "Logical or shortcircuts",
        "Exec2",
        "Exec3",
        "While",
        "Loop",
        "Loop fractional times",
        "Loop zero times",
        "Loop negative times",
        "Loop negative fractional times",
        "Equality (true)",
        "Equality epsilon",
        "!Equality (true)",
        "!Equality (false)",
        "!Equality epsilon",
        "Equality (false)",
        "Less than (true)",
        "Less than (false)",
        "Greater than (true)",
        "Greater than (false)",
        "Less than or equal (true)",
        "Less than or equal (false)",
        "Greater than or equal (true)",
        "Greater than or equal (false)",
        "Script without trailing semi",
        "Megabuf access",
        "Max index megabuf",
        "Max index + 1 megabuf",
        "Max index gmegabuf",
        "Max index+1 gmegabuf",
        "Megabuf assignment",
        "Megabuf assignment (idx 100.0)",
        "Megabuf (float)",
        "Gmegabuf",
        "Megabuf != Gmegabuf",
        "Gmegabuf != Megabuf",
        "Case insensitive vars",
        "Case insensitive funcs",
        "Consecutive semis",
        "Equality (< epsilon)",
        "Equality (< -epsilon)",
        "Variables don\'t collide",
        "Block comment",
        "Sigmoid 1, 2",
        "Sigmoid 2, 1",
        "Sigmoid 0, 0",
        "Sigmoid 10, 10",
        "Exp",
        "Floor",
        "Floor",
        "Ceil",
        "Ceil",
        "Assign",
        "Assign return value",
        "EPSILON buffer indexes",
        "+EPSILON & rounding -#s toward 0",
        "Negative buffer index read as 0",
        "Negative buffer index",
        "Negative buffer index gmegabuf",
        "Negative buf index execs right hand side",
        "Negative buf index +=",
        "Negative buf index -=",
        "Negative buf index *=",
        "Negative buf index /=",
        "Negative buf index %=",
        "Buff += mutates",
        "Buffers don\'t collide",
        "gmegabuf does not write megabuf",
        "megabuf does not write gmegabuf",
        "Adjacent buf indicies don\'t collide",
        "Exponentiation associativity",
        "^ has lower precedence than * (left)",
        "^ has lower precedence than * (right)",
        "% has lower precedence than * (right)",
        "% has lower precedence than * (left)",
        "% and ^ have the same precedence (% first)",
        "% and ^ have the same precedence (^ first)",
        "Loop limit",
        "Divide by zero",
        "Divide by less than epsilon",
    ];

    for (name, code, expected) in test_cases {
        match compile(code, vec![]) {
            Ok(binary) => {
                if expected_failing.contains(name) {
                    panic!(format!("Expected {} to fail, but it passed!", name));
                }
                let actual = run(&binary).expect("to run");
                assert_eq!(&actual, expected)
            }
            Err(err) => {
                if !expected_failing.contains(name) {
                    panic!(format!(
                        "Didn't expect \"{}\" to fail. Failed with {}",
                        name, err
                    ));
                }
            }
        }
    }
}
