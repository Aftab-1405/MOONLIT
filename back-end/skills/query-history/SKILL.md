---
name: query-history
description: Retrieve, identify, adapt, or rerun SQL from the user's earlier query history.
when_to_use: The user says earlier, previous, last query, same query, reuse, repeat, modify what we ran, or otherwise points to query history outside the active visible context.
avoid_when: The referenced SQL is visible in the current conversation, or the user wants a new query from current schema/data rather than a past query.
---

# Query History

Use `get_query_history` to retrieve SQL the user ran earlier — outside the visible chat window — when they reference it without pasting it again. Call the tool before asking the user to repeat themselves, and never fabricate a prior query.

## When to use `get_query_history`

The user references a past query using phrases like:

- "that query from earlier" / "the last query" / "the previous SELECT"
- "modify what we ran before" / "change that query we did"
- "do it again" / "run the same thing" / "reuse that"
- "the query I asked about [topic]" — topic-based reference (e.g., "the churn query")
- "make it filter by X instead" — implies a prior query exists to modify
- "what was that query we tried?" — explicit lookup

## When NOT to use `get_query_history`

- **The referenced SQL is visible in the active conversation.** Scroll up and use the visible query directly — do not call the tool.
- The user wants a brand-new query (no prior reference, fresh schema/data question).
- The user asks about schema or data without referencing a past query — use `database-querying` instead.
- The conversation is short (<3 messages) and no prior query could plausibly exist.
- The user pastes the SQL inline in the current message — work with what they pasted.

## Reference disambiguation

When the user's reference is ambiguous ("that query", "the one from before"), do not guess. Follow this procedure:

1. Call `get_query_history` to retrieve the recent history.
2. Rank candidates by:
   - **Recency** — most recent first.
   - **Topic match** — if the user mentioned a table, column, or concept, prefer queries that touched it.
   - **Query type** — if the user said "the SELECT" vs "the aggregate" vs "the join", filter by query shape.
3. If exactly one candidate is clearly the best match, proceed with it.
4. If **2+ candidates are plausible**, list them briefly and ask the user to confirm:
   > "I found these recent queries:
   > (1) `SELECT user_id, SUM(amount) FROM orders WHERE created_at > …` — ran 4 min ago
   > (2) `SELECT user_id, COUNT(*) FROM events WHERE …` — ran 12 min ago
   > Which one did you mean?"
5. **Never guess silently.** If unsure, ask.

## Adaptation patterns

After retrieving a past query, the user often wants to modify it. Apply the minimal diff that satisfies the request:

| User says | Adaptation |
|---|---|
| "add WHERE status = 'active'" | append or extend the `WHERE` clause |
| "group by month instead of day" | change `DATE_TRUNC('day', …)` → `DATE_TRUNC('month', …)` and update `GROUP BY` |
| "also include the orders table" | add a `JOIN` clause and any needed select-list columns |
| "sort by revenue desc, top 20" | modify `ORDER BY` and `LIMIT` |
| "only for last quarter" | add a date filter on the relevant timestamp column |
| "remove the deleted users" | add `WHERE deleted_at IS NULL` (or an equivalent exclusion) |

For each adaptation, show the modified query in a ```sql block and explain the change in one line: *"Changed: added `WHERE status = 'active'`."*

Preserve the original query's structure (CTE names, aliases, column order) unless the user explicitly asks to restructure. Minimal diffs are easier for the user to verify.

## Multi-query chaining

Sometimes the user references a sequence of queries ("the queries we ran for the churn analysis"). Follow this procedure:

1. Call `get_query_history`.
2. Identify the sequence by **timestamp proximity** and **topic** (queries touching the same tables/columns within a narrow time window).
3. Summarize what each query did, in order:
   > "Your churn analysis used 3 queries: (1) built the active-user cohort, (2) joined to cancellation events, (3) computed the 30-day churn rate."
4. Offer to rerun the sequence as-is, or build on it (e.g., add a new cohort filter to all three).

## Rerun vs modify vs explain

The user's verb determines the action:

| User says | Action |
|---|---|
| "run it again" / "do the same thing" / "rerun that" | Rerun the exact query via `execute_query` — no edits. |
| "modify" / "change" / "add" / "instead of" | Apply the adaptation, show the diff, then run via `execute_query`. |
| "what did that query do?" / "explain that query" | Explain the query in prose — do **not** run it unless the user then asks. |

## Anti-fabrication rules

- **Never invent a previous query.** If `get_query_history` returns empty or no match, say:
  > "I don't see a matching query in your recent history. Could you share it again, or describe what it did?"
- Never present a guessed or templated query as "the one you ran before".
- If the retrieved query is too old or truncated to be useful, say so and ask the user to paste it.

## Output format

When reusing a past query, structure the response as:

1. **Acknowledge** in one line: *"Reusing your query from earlier: [1-line description]."*
2. **Show the query** in a ```sql block.
3. **If modified**, state the change: *"Changed: added `WHERE status = 'active'`."* Show the modified SQL if the diff is non-obvious.
4. **Run it** via `execute_query` with an appropriate `max_rows` (default 100).
5. **Present the results** — interpret the rows in prose; do not repeat them as a manual table unless the user asks.

## Failures

On a tool failure from `get_query_history`, retry once only if the failure was transient (timeout, network). Otherwise ask the user to paste the prior query directly. Do not attempt to reconstruct it from memory or conversation context.
