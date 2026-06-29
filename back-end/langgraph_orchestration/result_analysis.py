"""Deterministic analysis over a bounded, persisted SQL execution result."""

from __future__ import annotations

import json
import math
import statistics
from decimal import Decimal
from typing import Any


def _hashable(value: Any) -> str:
    return json.dumps(value, sort_keys=True, default=str, separators=(",", ":"))


def _numeric(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _column_profile(rows: list[dict], column: str) -> dict:
    values = [row.get(column) for row in rows]
    non_null = [value for value in values if value is not None]
    numeric = [number for value in non_null if (number := _numeric(value)) is not None]
    result = {
        "count": len(values),
        "non_null_count": len(non_null),
        "null_count": len(values) - len(non_null),
        "distinct_count": len({_hashable(value) for value in non_null}),
        "numeric_count": len(numeric),
    }
    if numeric:
        result["numeric"] = {
            "min": min(numeric),
            "max": max(numeric),
            "mean": statistics.fmean(numeric),
            "median": statistics.median(numeric),
            "sample_stddev": statistics.stdev(numeric) if len(numeric) > 1 else None,
        }
    return result


def analyze_execution_result(
    execution: dict,
    *,
    operation: str,
    columns: list[str] | None = None,
) -> dict:
    rows = execution.get("data") or []
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        return {"success": False, "error": "Execution result rows are unavailable"}

    available = list(execution.get("columns") or (list(rows[0]) if rows else []))
    selected = list(columns or available)
    unknown = [column for column in selected if column not in available]
    if unknown:
        return {
            "success": False,
            "error": "Unknown columns: " + ", ".join(unknown),
            "available_columns": available,
        }

    scope = {
        "analyzed_rows": len(rows),
        "source_truncated": bool(execution.get("truncated")),
        "scope_note": (
            "Statistics cover only the bounded query result, not all database rows."
            if execution.get("truncated")
            else "Statistics cover every row returned by the source query."
        ),
    }

    if operation == "profile":
        if len(selected) > 50:
            return {"success": False, "error": "Profile at most 50 columns per call"}
        return {
            "success": True,
            "operation": operation,
            **scope,
            "columns": {
                column: _column_profile(rows, column) for column in selected
            },
        }

    if operation == "data_quality":
        row_keys = [_hashable(row) for row in rows]
        return {
            "success": True,
            "operation": operation,
            **scope,
            "duplicate_row_count": len(row_keys) - len(set(row_keys)),
            "columns": {
                column: {
                    key: value
                    for key, value in _column_profile(rows, column).items()
                    if key in {"count", "non_null_count", "null_count", "distinct_count"}
                }
                for column in selected
            },
        }

    if operation == "correlation":
        if len(selected) != 2:
            return {
                "success": False,
                "error": "Correlation requires exactly two columns",
            }
        left, right = selected
        pairs = []
        for row in rows:
            x, y = _numeric(row.get(left)), _numeric(row.get(right))
            if x is not None and y is not None:
                pairs.append((x, y))
        if len(pairs) < 2:
            return {"success": False, "error": "At least two numeric pairs are required"}
        xs, ys = zip(*pairs)
        mean_x, mean_y = statistics.fmean(xs), statistics.fmean(ys)
        numerator = sum((x - mean_x) * (y - mean_y) for x, y in pairs)
        denominator = math.sqrt(
            sum((x - mean_x) ** 2 for x in xs)
            * sum((y - mean_y) ** 2 for y in ys)
        )
        if denominator == 0:
            return {"success": False, "error": "Correlation is undefined for a constant column"}
        return {
            "success": True,
            "operation": operation,
            **scope,
            "columns": selected,
            "paired_numeric_rows": len(pairs),
            "pearson_correlation": numerator / denominator,
        }

    return {"success": False, "error": f"Unsupported analysis operation: {operation}"}
