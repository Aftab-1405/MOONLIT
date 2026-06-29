---
name: database-querying
description: Inspect connected schemas and indexes, write read-only SQL, execute queries, and analyze database results.
when_to_use: The task needs connected-database facts, SQL generation, schema inspection, live rows, aggregates, rankings, counts, or database UI actions.
avoid_when: The user is asking about app code, frontend UI, general conversation, external documentation, or a diagram that can be answered from already-visible schema context.
---

# Database Querying

Use the fewest calls that produce verified evidence.

## Workflow

1. Reuse exact active-context evidence only when it answers the request and freshness is not material.
2. Use `get_schema_overview(target_tables?)` before SQL when relevant tables, columns, or relationships are unknown. Do not chain narrower schema calls when one overview is enough.
3. Use `get_table_indexes(table_name)` only for index or query-performance work.
4. Use `execute_query(query, max_rows)` whenever the answer depends on current rows, rankings, counts, totals, revenue, growth, or comparisons.
5. For profiling, trends, correlations, data-quality checks, or exploratory work, run a sequence of focused aggregate queries. Interpret each bounded result, refine the next query, and stop only when the requested analysis is supported.
6. Use `analyze_query_result(execution_id, operation, columns?)` for deterministic descriptive profiles, null/distinct/duplicate checks, or Pearson correlation over a prior bounded query result. If that query was truncated, explicitly treat the computed values as sample/result-window statistics rather than whole-table statistics.
7. Stop when sufficient evidence exists.

Write only read-only `SELECT` or `WITH` SQL. Choose the narrowest query that answers the request. Default `max_rows` to 100; use 10-25 for broad exploration. State a defensible business assumption briefly when it affects the query.

Never answer live-data questions from intuition, naming patterns, examples, or historical summaries. Never invent or extrapolate rows. A preview proves only the visible rows; do not claim a complete top-N result unless the evidence contains it. Run a focused follow-up query when the preview cannot support the requested conclusion.

## Result Presentation

The UI automatically renders every successful `execute_query` result in chat as an interactive Material React Table. A bounded preview is also available to you so you can interpret aggregate values and continue a multi-step analysis. For ordinary requests, synthesize the finding in prose rather than repeating the rows as another table.

Only build a table in the assistant response when the user explicitly requests one. First explain that you can access only preview rows, so the manual table can include only those data points and must not be presented as the complete result. If no suitable fresh query exists, run one so the full available result appears in the interactive chat table. If it already ran, point to that table instead of rerunning it.

## Failures

On a tool failure, retry once only when a clearly safer or corrected call exists. Otherwise report the failure. For a missing table, present verified likely matches and ask one question. For an empty result, say nothing matched and suggest one useful filter adjustment.
