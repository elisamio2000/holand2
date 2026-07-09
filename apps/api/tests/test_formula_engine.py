from app.services.formula_engine import FormulaError, evaluate_formula, validate_formula


def test_formula_engine_evaluates_valid_expression() -> None:
    expr = "(E - I) / (E + I) * 100 if (E + I) > 0 else 0"
    validate_formula(expr, ["E", "I"])
    value = evaluate_formula(expr, {"E": 8, "I": 2})
    assert value == 60.0


def test_formula_engine_blocks_unsafe_calls() -> None:
    expr = '__import__("os").system("echo hi")'
    try:
        evaluate_formula(expr, {})
        raise AssertionError("unsafe call should have been blocked")
    except FormulaError as exc:
        assert "allow-listed functions" in str(exc)


def test_formula_engine_rejects_undeclared_variables() -> None:
    expr = "X + 1"
    try:
        validate_formula(expr, ["E"])
        raise AssertionError("undeclared variable should have been rejected")
    except FormulaError as exc:
        assert "undeclared variables" in str(exc)
