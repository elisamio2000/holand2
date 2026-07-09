"""Safe DSL formula engine (Phase 2).

Formulas are stored as JSON in ``ScoringFormulaVersion.expression``:

```json
{"expr": "(E - I) / (E + I) * 100 if (E + I) > 0 else 0"}
```

``evaluate_formula`` parses the expression with Python's ``ast`` module and
walks a strict allow-list of node types so analysts can write familiar
arithmetic/conditional syntax without any code-execution risk (no attribute
access, no function calls except a small allow-listed set, no imports, no
comprehensions, no name lookups besides the supplied variables/allow-listed
builtins).

This satisfies docs/questionnaire-scoring-design-fa.md #5 ("DSL فرمول و
معادلات قابل ویرایش") without adding a third-party expression-eval dependency.
"""

from __future__ import annotations

import ast
import math
import operator
from typing import Any

__all__ = [
    "FormulaError",
    "evaluate_formula",
    "validate_formula",
    "extract_variables",
    "validate_formula_version_payload",
]


class FormulaError(ValueError):
    """Raised when a formula fails to parse, validate, or evaluate safely."""


_ALLOWED_BINOPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.FloorDiv: operator.floordiv,
}

_ALLOWED_UNARYOPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
    ast.Not: operator.not_,
}

_ALLOWED_COMPARE = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}

_ALLOWED_FUNCS: dict[str, Any] = {
    "max": max,
    "min": min,
    "abs": abs,
    "round": round,
    "sum": lambda *args: sum(args[0]) if len(args) == 1 and _is_iterable(args[0]) else sum(args),
}


def _is_iterable(value: Any) -> bool:
    return isinstance(value, list | tuple)


def extract_variables(expression: str) -> set[str]:
    """Return the set of free variable names referenced by an expression."""
    tree = ast.parse(expression, mode="eval")
    return {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)} - set(_ALLOWED_FUNCS)


def validate_formula(expression: str, input_variables: list[str]) -> None:
    """Parse the expression and ensure it only references declared variables/functions."""
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise FormulaError(f"Invalid formula syntax: {exc}") from exc

    _check_node(tree)

    used = extract_variables(expression)
    unknown = used - set(input_variables)
    if unknown:
        raise FormulaError(
            f"Formula references undeclared variables: {', '.join(sorted(unknown))}"
        )


def evaluate_formula(expression: str, variables: dict[str, float]) -> float:
    """Safely evaluate ``expression`` with the given variable bindings."""
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise FormulaError(f"Invalid formula syntax: {exc}") from exc

    _check_node(tree)
    try:
        return _eval(tree.body, variables)
    except FormulaError:
        raise
    except ZeroDivisionError as exc:
        raise FormulaError("Division by zero in formula") from exc
    except Exception as exc:  # noqa: BLE001 - surface as FormulaError
        raise FormulaError(f"Formula evaluation failed: {exc}") from exc


def validate_formula_version_payload(
    *,
    expression: str,
    input_variables: list[str],
    validation_rules: dict[str, Any] | None,
    unit_tests: list[dict[str, Any]] | None,
) -> None:
    """Validate full formula payload used by governance transitions.

    Besides AST and variable validation, this executes formula unit tests and
    optional min/max bounds checks.
    """
    validate_formula(expression, input_variables)

    errors: list[str] = []
    tests = unit_tests or []
    rules = validation_rules or {}

    min_bound = rules.get("min")
    max_bound = rules.get("max")
    if min_bound is not None and not isinstance(min_bound, int | float):
        errors.append("validation_rules.min must be numeric when provided")
    if max_bound is not None and not isinstance(max_bound, int | float):
        errors.append("validation_rules.max must be numeric when provided")
    if errors:
        raise FormulaError("; ".join(errors))

    for index, test_case in enumerate(tests):
        if not isinstance(test_case, dict):
            errors.append(f"unit_tests[{index}] must be an object")
            continue

        variables = test_case.get("variables")
        expected = test_case.get("expected")
        tolerance = test_case.get("tolerance", 1e-6)

        if not isinstance(variables, dict):
            errors.append(f"unit_tests[{index}].variables must be an object")
            continue
        if expected is not None and not isinstance(expected, int | float):
            errors.append(f"unit_tests[{index}].expected must be numeric when provided")
            continue
        if not isinstance(tolerance, int | float):
            errors.append(f"unit_tests[{index}].tolerance must be numeric")
            continue

        try:
            value = evaluate_formula(expression, variables)
        except FormulaError as exc:
            errors.append(f"unit_tests[{index}] evaluation failed: {exc}")
            continue

        if not isinstance(value, int | float) or not math.isfinite(value):
            errors.append(f"unit_tests[{index}] produced a non-finite numeric result")
            continue

        if min_bound is not None and value < float(min_bound):
            errors.append(
                f"unit_tests[{index}] result {value} is below validation_rules.min {min_bound}"
            )
        if max_bound is not None and value > float(max_bound):
            errors.append(
                f"unit_tests[{index}] result {value} is above validation_rules.max {max_bound}"
            )
        if expected is not None and abs(value - float(expected)) > float(tolerance):
            errors.append(
                f"unit_tests[{index}] expected {expected} with tolerance {tolerance}, got {value}"
            )

    if errors:
        raise FormulaError("; ".join(errors))


_ALLOWED_NODE_TYPES = (
    ast.Expression,
    ast.BinOp,
    ast.UnaryOp,
    ast.BoolOp,
    ast.Compare,
    ast.IfExp,
    ast.Call,
    ast.Name,
    ast.Load,
    ast.Constant,
    ast.And,
    ast.Or,
    ast.List,
    ast.Tuple,
    *(_ALLOWED_BINOPS.keys()),
    *(_ALLOWED_UNARYOPS.keys()),
    *(_ALLOWED_COMPARE.keys()),
)


def _check_node(node: ast.AST) -> None:
    for child in ast.walk(node):
        if not isinstance(child, _ALLOWED_NODE_TYPES):
            raise FormulaError(f"Disallowed expression element: {type(child).__name__}")
        if isinstance(child, ast.Constant) and not isinstance(child.value, int | float | bool):
            raise FormulaError("Only numeric constants are allowed in formulas")
        if isinstance(child, ast.Call):
            if not isinstance(child.func, ast.Name) or child.func.id not in _ALLOWED_FUNCS:
                raise FormulaError("Only allow-listed functions may be called")
            if child.keywords:
                raise FormulaError("Keyword arguments are not supported in formulas")


def _eval(node: ast.AST, variables: dict[str, float]) -> Any:
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        if node.id in _ALLOWED_FUNCS:
            return _ALLOWED_FUNCS[node.id]
        if node.id not in variables:
            raise FormulaError(f"Unknown variable: {node.id}")
        return variables[node.id]
    if isinstance(node, ast.BinOp):
        op = _ALLOWED_BINOPS.get(type(node.op))
        if op is None:
            raise FormulaError(f"Disallowed operator: {type(node.op).__name__}")
        return op(_eval(node.left, variables), _eval(node.right, variables))
    if isinstance(node, ast.UnaryOp):
        op = _ALLOWED_UNARYOPS.get(type(node.op))
        if op is None:
            raise FormulaError(f"Disallowed operator: {type(node.op).__name__}")
        return op(_eval(node.operand, variables))
    if isinstance(node, ast.BoolOp):
        values = [_eval(v, variables) for v in node.values]
        return all(values) if isinstance(node.op, ast.And) else any(values)
    if isinstance(node, ast.Compare):
        left = _eval(node.left, variables)
        for op_node, comparator in zip(node.ops, node.comparators, strict=False):
            op = _ALLOWED_COMPARE.get(type(op_node))
            if op is None:
                raise FormulaError(f"Disallowed comparator: {type(op_node).__name__}")
            right = _eval(comparator, variables)
            if not op(left, right):
                return False
            left = right
        return True
    if isinstance(node, ast.IfExp):
        return (
            _eval(node.body, variables)
            if _eval(node.test, variables)
            else _eval(node.orelse, variables)
        )
    if isinstance(node, ast.List | ast.Tuple):
        return [_eval(elt, variables) for elt in node.elts]
    if isinstance(node, ast.Call):
        func = _ALLOWED_FUNCS[node.func.id]
        args = [_eval(arg, variables) for arg in node.args]
        return func(*args)
    raise FormulaError(f"Unsupported expression element: {type(node).__name__}")
