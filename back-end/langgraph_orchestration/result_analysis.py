"""Deterministic analysis over a bounded, persisted SQL execution result.

This module provides statistical profiling, data-quality checks, and correlation
analysis over the bounded result set of a prior ``execute_query`` tool call.
The analysis runs entirely on the persisted rows loaded from Firestore — no
database round-trip is needed.

Row-count safety
----------------
A single ``execute_query`` can return up to ``MAX_QUERY_RESULTS`` rows (1000 by
default). To prevent OOM on very large or very wide results, ``analyze_execution_result``
enforces a :data:`MAX_ANALYZE_ROWS` guard and :func:`_column_profile` accumulates
statistics in a single pass rather than building multiple intermediate lists.
"""

from __future__ import annotations

import json
import math
import statistics
from decimal import Decimal
from typing import Any

# FIX [M9]: Guard against unbounded memory usage. Previously, _column_profile
# iterated the full row set multiple times per column (values, non_null, numeric,
# distinct set), and data_quality built a _hashable(row) list for every row.
# For 1000 rows × 50 columns this was 50,000 cell accesses per profile pass plus
# 1000 json.dumps. Now we cap the total row count and use single-pass accumulation.
MAX_ANALYZE_ROWS = 1000


def _hashable(value: Any) -> str:
    """Serialize a value to a deterministic JSON string for set-based deduplication."""
    return json.dumps(value, sort_keys=True, default=str, separators=(",", ":"))


def _numeric(value: Any) -> float | None:
    """Coerce a value to float, returning None for non-numeric or non-finite values."""
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _column_profile(rows: list[dict], column: str) -> dict:
    """Compute per-column statistics in a single pass over the rows.

    FIX [M9]: Previously this function built three intermediate lists (values,
    non_null, numeric) plus a distinct-count set, iterating the full row set
    3-4 times per column. Now we accumulate all metrics in a single pass,
    reducing memory and CPU for wide results.
    """
    count = 0
    non_null_count = 0
    distinct: set[str] = set()
    numeric_values: list[float] = []

    for row in rows:
        count += 1
        value = row.get(column)
        if value is not None:
            non_null_count += 1
            distinct.add(_hashable(value))
            number = _numeric(value)
            if number is not None:
                numeric_values.append(number)

    result = {
        "count": count,
        "non_null_count": non_null_count,
        "null_count": count - non_null_count,
        "distinct_count": len(distinct),
        "numeric_count": len(numeric_values),
    }
    if numeric_values:
        result["numeric"] = {
            "min": min(numeric_values),
            "max": max(numeric_values),
            "mean": statistics.fmean(numeric_values),
            "median": statistics.median(numeric_values),
            "sample_stddev": statistics.stdev(numeric_values) if len(numeric_values) > 1 else None,
        }
    return result


def analyze_execution_result(
    execution: dict,
    *,
    operation: str,
    columns: list[str] | None = None,
) -> dict:
    """Analyze a persisted SQL execution result.

    Args:
        execution: The full execution result dict (columns + data + metadata)
            loaded from Firestore.
        operation: One of ``"profile"``, ``"data_quality"``, ``"correlation"``.
        columns: Optional subset of columns to analyze. Defaults to all
            available columns.

    Returns:
        Analysis result dict with ``success`` flag and operation-specific
        metrics. All errors are returned as ``{"success": False, "error": ...}``
        rather than raised.
    """
    rows = execution.get("data") or []
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        return {"success": False, "error": "Execution result rows are unavailable"}

    # FIX [M9]: Row-count guard prevents OOM on very large persisted results.
    # If MAX_QUERY_RESULTS is ever raised or if the result contains very wide
    # rows (e.g., 200 columns), the multi-pass profiling would spike memory and
    # CPU. We refuse to analyze results exceeding MAX_ANALYZE_ROWS.
    if len(rows) > MAX_ANALYZE_ROWS:
        return {
            "success": False,
            "error": (
                f"Analysis supports at most {MAX_ANALYZE_ROWS} rows; "
                f"got {len(rows)}. Narrow the query or reduce the result set."
            ),
            "row_count": len(rows),
            "max_analyze_rows": MAX_ANALYZE_ROWS,
        }

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
            "columns": {column: _column_profile(rows, column) for column in selected},
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
            return {
                "success": False,
                "error": "At least two numeric pairs are required",
            }
        xs, ys = zip(*pairs)
        mean_x, mean_y = statistics.fmean(xs), statistics.fmean(ys)
        numerator = sum((x - mean_x) * (y - mean_y) for x, y in pairs)
        denominator = math.sqrt(sum((x - mean_x) ** 2 for x in xs) * sum((y - mean_y) ** 2 for y in ys))
        if denominator == 0:
            return {
                "success": False,
                "error": "Correlation is undefined for a constant column",
            }
        return {
            "success": True,
            "operation": operation,
            **scope,
            "columns": selected,
            "paired_numeric_rows": len(pairs),
            "pearson_correlation": numerator / denominator,
        }

    return {"success": False, "error": f"Unsupported analysis operation: {operation}"}
