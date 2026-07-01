---
name: query-history
description: Retrieve, identify, adapt, or rerun SQL from the user's earlier query history.
when_to_use: The user says earlier, previous, last query, same query, reuse, repeat, modify what we ran, or otherwise points to query history outside the active visible context.
avoid_when: The referenced SQL is visible in the current conversation, or the user wants a new query from current schema/data rather than a past query.
---

# Query History

Use `get_query_history` when the user references a past query: "that query from earlier", "the last SELECT", "modify what we did before", "do it again", "reuse that", or similar.

Do not call `get_query_history` if the referenced query is visible in the active conversation; use the visible query directly.

## Pattern

1. Detect the prior-query reference.
2. Call `get_query_history` before guessing or asking the user to repeat it.
3. Pick the most likely query from the returned history based on context.
4. Adapt it or run it as needed.

If no relevant query is found, say: "I don't see a matching query in your recent history — can you share it again?"

Never fabricate a previous query.
